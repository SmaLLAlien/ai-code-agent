import { randomUUID } from 'node:crypto';
import { type AGUIEvent, EventType } from '@ag-ui/core';
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';

/**
 * Translates pi agent session events into AG-UI events for one run.
 *
 * The AG-UI client validates the stream strictly (no CONTENT/END without START, no RUN_FINISHED
 * with open messages, no `null` in optional fields), so the translator tracks what is open and
 * `closeOpen()` must be called before RUN_FINISHED / RUN_ERROR.
 */
export class PiToAgUiTranslator {
  private openMessageId: string | undefined;
  private llmError: string | undefined;

  /** Error reported by the model during the run, if any. */
  get error(): string | undefined {
    return this.llmError;
  }

  translate(event: AgentSessionEvent): AGUIEvent[] {
    switch (event.type) {
      case 'message_update': {
        const update = event.assistantMessageEvent;
        switch (update.type) {
          case 'text_start':
            return [...this.endMessage(), ...this.startMessage()];
          case 'text_delta':
            if (!update.delta) {
              return [];
            }
            return [
              ...(this.openMessageId ? [] : this.startMessage()),
              {
                type: EventType.TEXT_MESSAGE_CONTENT,
                messageId: this.openMessageId!,
                delta: update.delta,
              },
            ];
          case 'text_end':
            return this.endMessage();
          case 'error':
            if (update.reason === 'error') {
              this.llmError = update.error.errorMessage ?? 'Model request failed';
            }
            return [];
          default:
            return [];
        }
      }
      case 'message_end': {
        // A failed model request (auth, network, 4xx/5xx) ends the assistant message with
        // stopReason 'error'; pi does not emit a message_update 'error' for it.
        const message = event.message as { role?: string; stopReason?: string; errorMessage?: string };
        if (message.role === 'assistant' && message.stopReason === 'error') {
          this.llmError = message.errorMessage ?? 'Model request failed';
        }
        return this.endMessage();
      }
      case 'tool_execution_start':
        return [
          ...this.endMessage(),
          {
            type: EventType.TOOL_CALL_START,
            toolCallId: event.toolCallId,
            toolCallName: event.toolName,
          },
          {
            type: EventType.TOOL_CALL_ARGS,
            toolCallId: event.toolCallId,
            delta: JSON.stringify(event.args ?? {}),
          },
          { type: EventType.TOOL_CALL_END, toolCallId: event.toolCallId },
        ];
      case 'tool_execution_end':
        return [
          {
            type: EventType.TOOL_CALL_RESULT,
            messageId: randomUUID(),
            toolCallId: event.toolCallId,
            content: toolResultText(event.result, event.isError),
          },
        ];
      default:
        return [];
    }
  }

  closeOpen(): AGUIEvent[] {
    // Tool calls are emitted as START/ARGS/END at once, so only a text message can stay open.
    return this.endMessage();
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
}

/** Joins the text parts of a pi tool result (`{ content: (TextContent | ImageContent)[] }`). */
function toolResultText(result: unknown, isError: boolean): string {
  const content = (result as { content?: unknown } | undefined)?.content;
  const text = Array.isArray(content)
    ? content
        .filter(
          (part): part is { type: 'text'; text: string } =>
            typeof part === 'object' && part !== null && part.type === 'text',
        )
        .map((part) => part.text)
        .join('\n')
    : '';
  return isError ? `Error: ${text}` : text;
}
