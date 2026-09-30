import { randomUUID } from 'node:crypto';
import { type AGUIEvent, EventType } from '@ag-ui/core';
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { ASK_USER } from '../agent/tools/ask-user.tool.js';
import { UPDATE_TODO } from '../agent/tools/update-todo.tool.js';
import type { ChatState } from '../chats/chat-state.js';

/** AG-UI CUSTOM event names understood by the chat UI. */
export const CustomEventName = {
  /** `{ toolCallId, text }` — live output of a running tool (e.g. bash). */
  ToolOutput: 'tool_output',
  /** `{ toolCallId, isError }` — sent before TOOL_CALL_RESULT when a tool failed. */
  ToolStatus: 'tool_status',
  /** `{ toolCallId, questions }` — the agent asks the user; the turn ends after it. */
  AskUser: 'ask_user',
  /** `{ content }` — the plan was written in plan mode and waits for approval. */
  PlanReady: 'plan_ready',
  /** `{ commit, files }` — files the agent changed during the run, committed as a checkpoint. */
  FilesChanged: 'files_changed',
} as const;

const FILE_WRITE_TOOLS = new Set(['write', 'edit']);

/**
 * Translates pi agent session events into AG-UI events for one run.
 *
 * The AG-UI client validates the stream strictly (no CONTENT/END without START, no RUN_FINISHED
 * with open messages, no `null` in optional fields), so the translator tracks what is open and
 * `closeOpen()` must be called before RUN_FINISHED / RUN_ERROR.
 */
export class PiToAgUiTranslator {
  private openMessageId: string | undefined;
  private openReasoning: { spanId: string; messageId: string } | undefined;
  private llmError: string | undefined;
  private readonly toolPaths = new Map<string, string>();
  private readonly writtenPaths = new Set<string>();

  constructor(private readonly state: ChatState) {}

  /** Error reported by the model during the run, if any. */
  get error(): string | undefined {
    return this.llmError;
  }

  /** Paths (as given to the tools) successfully written or edited during the run. */
  get writtenFiles(): ReadonlySet<string> {
    return this.writtenPaths;
  }

  stateSnapshot(): AGUIEvent {
    return {
      type: EventType.STATE_SNAPSHOT,
      snapshot: { mode: this.state.mode, todo: this.state.todo },
    };
  }

  translate(event: AgentSessionEvent): AGUIEvent[] {
    switch (event.type) {
      case 'message_update':
        return this.translateMessageUpdate(event.assistantMessageEvent);
      case 'message_end': {
        // A failed model request (auth, network, 4xx/5xx) ends the assistant message with
        // stopReason 'error'; pi does not emit a message_update 'error' for it.
        const message = event.message as { role?: string; stopReason?: string; errorMessage?: string };
        if (message.role === 'assistant' && message.stopReason === 'error') {
          this.llmError = message.errorMessage ?? 'Model request failed';
        }
        return [...this.endReasoning(), ...this.endMessage()];
      }
      case 'tool_execution_start':
        return this.toolStart(event.toolCallId, event.toolName, event.args);
      case 'tool_execution_update': {
        const text = resultText(event.partialResult);
        return text
          ? [custom(CustomEventName.ToolOutput, { toolCallId: event.toolCallId, text })]
          : [];
      }
      case 'tool_execution_end':
        return this.toolEnd(event.toolCallId, event.toolName, event.result, event.isError);
      default:
        return [];
    }
  }

  closeOpen(): AGUIEvent[] {
    // Tool calls are emitted as START/ARGS/END at once, so only text/reasoning can stay open.
    return [...this.endReasoning(), ...this.endMessage()];
  }

  private translateMessageUpdate(
    update: Extract<AgentSessionEvent, { type: 'message_update' }>['assistantMessageEvent'],
  ): AGUIEvent[] {
    switch (update.type) {
      case 'text_start':
        return [...this.endReasoning(), ...this.endMessage(), ...this.startMessage()];
      case 'text_delta':
        if (!update.delta) {
          return [];
        }
        return [
          ...(this.openMessageId ? [] : this.startMessage()),
          { type: EventType.TEXT_MESSAGE_CONTENT, messageId: this.openMessageId!, delta: update.delta },
        ];
      case 'text_end':
        return this.endMessage();
      case 'thinking_start':
        return [...this.endMessage(), ...this.endReasoning(), ...this.startReasoning()];
      case 'thinking_delta':
        if (!update.delta) {
          return [];
        }
        return [
          ...(this.openReasoning ? [] : this.startReasoning()),
          {
            type: EventType.REASONING_MESSAGE_CONTENT,
            messageId: this.openReasoning!.messageId,
            delta: update.delta,
          },
        ];
      case 'thinking_end':
        return this.endReasoning();
      case 'error':
        if (update.reason === 'error') {
          this.llmError = update.error.errorMessage ?? 'Model request failed';
        }
        return [];
      default:
        return [];
    }
  }

  private toolStart(toolCallId: string, toolName: string, args: unknown): AGUIEvent[] {
    const input = (args ?? {}) as Record<string, unknown>;
    if (FILE_WRITE_TOOLS.has(toolName) && typeof input['path'] === 'string') {
      this.toolPaths.set(toolCallId, input['path']);
    }
    return [
      ...this.endReasoning(),
      ...this.endMessage(),
      { type: EventType.TOOL_CALL_START, toolCallId, toolCallName: toolName },
      { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(input) },
      { type: EventType.TOOL_CALL_END, toolCallId },
      ...(toolName === ASK_USER
        ? [custom(CustomEventName.AskUser, { toolCallId, questions: input['questions'] ?? [] })]
        : []),
    ];
  }

  private toolEnd(toolCallId: string, toolName: string, result: unknown, isError: boolean): AGUIEvent[] {
    const writtenPath = this.toolPaths.get(toolCallId);
    this.toolPaths.delete(toolCallId);
    if (writtenPath && !isError) {
      this.writtenPaths.add(writtenPath);
    }
    return [
      ...(isError ? [custom(CustomEventName.ToolStatus, { toolCallId, isError: true })] : []),
      {
        type: EventType.TOOL_CALL_RESULT,
        messageId: randomUUID(),
        toolCallId,
        content: resultText(result),
      },
      // update_todo has already changed the chat state when the tool finishes.
      ...(toolName === UPDATE_TODO && !isError ? [this.stateSnapshot()] : []),
    ];
  }

  private startMessage(): AGUIEvent[] {
    this.openMessageId = randomUUID();
    return [
      { type: EventType.TEXT_MESSAGE_START, messageId: this.openMessageId, role: 'assistant' },
    ];
  }

  private endMessage(): AGUIEvent[] {
    if (!this.openMessageId) {
      return [];
    }
    const messageId = this.openMessageId;
    this.openMessageId = undefined;
    return [{ type: EventType.TEXT_MESSAGE_END, messageId }];
  }

  private startReasoning(): AGUIEvent[] {
    this.openReasoning = { spanId: randomUUID(), messageId: randomUUID() };
    const { spanId, messageId } = this.openReasoning;
    return [
      { type: EventType.REASONING_START, messageId: spanId },
      { type: EventType.REASONING_MESSAGE_START, messageId, role: 'reasoning' },
    ];
  }

  private endReasoning(): AGUIEvent[] {
    if (!this.openReasoning) {
      return [];
    }
    const { spanId, messageId } = this.openReasoning;
    this.openReasoning = undefined;
    return [
      { type: EventType.REASONING_MESSAGE_END, messageId },
      { type: EventType.REASONING_END, messageId: spanId },
    ];
  }
}

export function custom(name: string, value: unknown): AGUIEvent {
  return { type: EventType.CUSTOM, name, value };
}

/** Joins the text parts of a pi tool result (`{ content: (TextContent | ImageContent)[] }`). */
function resultText(result: unknown): string {
  const content = (result as { content?: unknown } | undefined)?.content;
  return Array.isArray(content)
    ? content
        .filter(
          (part): part is { type: 'text'; text: string } =>
            typeof part === 'object' && part !== null && part.type === 'text',
        )
        .map((part) => part.text)
        .join('\n')
    : '';
}
