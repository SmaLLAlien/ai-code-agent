import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { type AGUIEvent, EventType, type RunAgentInput } from '@ag-ui/core';
import { EventEncoder } from '@ag-ui/encoder';
import { Router } from 'express';
import { custom, CustomEventName, PiToAgUiTranslator } from '../agui/pi-to-agui.js';
import { CHAT_MODES, type ChatMode, PLAN_FILE } from '../chats/chat-state.js';
import { type Chat, chatRegistry } from '../chats/chat.registry.js';
import { commitCheckpoint } from '../workspaces/checkpoint.js';

export const chatsRouter = Router();

chatsRouter.post('/', async (_req, res) => {
  const chat = await chatRegistry.create();
  res.status(201).json({ id: chat.id });
});

/**
 * AG-UI endpoint: one POST per run, the response is an SSE stream of AG-UI events.
 * Only the last user message is used - the pi session keeps the conversation history itself.
 */
chatsRouter.post('/:id/run', async (req, res) => {
  const chat = chatRegistry.get(req.params.id);
  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  const { session } = chat;
  if (session.isStreaming) {
    res.status(409).json({ error: 'Run already in progress' });
    return;
  }
  const input = req.body as Partial<RunAgentInput>;
  const text = lastUserText(input);
  if (!text) {
    res.status(400).json({ error: 'No user message' });
    return;
  }

  const threadId = chat.id;
  const runId = input.runId ?? randomUUID();
  const encoder = new EventEncoder();
  const send = (event: AGUIEvent): void => {
    // After the client disconnects the socket is destroyed; writing would emit an error.
    if (!res.destroyed && !res.writableEnded) {
      res.write(encoder.encode(event));
    }
  };

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  const mode = (input.forwardedProps as { mode?: unknown } | undefined)?.mode;
  if (CHAT_MODES.includes(mode as ChatMode)) {
    chat.state.mode = mode as ChatMode;
  }

  const translator = new PiToAgUiTranslator(chat.state);
  send({ type: EventType.RUN_STARTED, threadId, runId });
  send(translator.stateSnapshot());
  const unsubscribe = session.subscribe((event) => translator.translate(event).forEach(send));

  let finished = false;
  res.on('close', () => {
    // Client pressed Stop or went away before the run ended.
    if (!finished) {
      void session.abort();
    }
  });

  try {
    await session.prompt(text);
    translator.closeOpen().forEach(send);
    (await runOutcomeEvents(chat, translator, text)).forEach(send);
    send(
      translator.error
        ? { type: EventType.RUN_ERROR, message: translator.error }
        : { type: EventType.RUN_FINISHED, threadId, runId },
    );
  } catch (err) {
    console.error(err);
    translator.closeOpen().forEach(send);
    send({ type: EventType.RUN_ERROR, message: 'Agent run failed' });
  } finally {
    finished = true;
    unsubscribe();
    res.end();
  }
});

chatsRouter.post('/:id/abort', async (req, res) => {
  const chat = chatRegistry.get(req.params.id);
  if (!chat) {
    res.status(404).json({ error: 'Chat not found' });
    return;
  }
  await chat.session.abort();
  res.status(204).end();
});

/**
 * Events produced after the agent finished: in plan mode the written plan is committed and waits
 * for approval, in agent mode the changes are committed as a checkpoint.
 */
async function runOutcomeEvents(
  chat: Chat,
  translator: PiToAgUiTranslator,
  request: string,
): Promise<AGUIEvent[]> {
  const planPath = path.resolve(chat.workspacePath, PLAN_FILE);
  const planWritten = [...translator.writtenFiles].some(
    (file) => path.resolve(chat.workspacePath, file) === planPath,
  );
  if (chat.state.mode === 'plan' && planWritten) {
    // Commit each plan version so the history shows how the plan evolved before approval.
    await commitCheckpoint(chat.workspacePath, `plan: ${request}`);
    const content = await fs.readFile(planPath, 'utf8');
    return [custom(CustomEventName.PlanReady, { content })];
  }
  if (chat.state.mode === 'agent') {
    const checkpoint = await commitCheckpoint(chat.workspacePath, request);
    return checkpoint ? [custom(CustomEventName.FilesChanged, checkpoint)] : [];
  }
  return [];
}

function lastUserText(input: Partial<RunAgentInput>): string {
  const message = [...(input.messages ?? [])].reverse().find((m) => m.role === 'user');
  if (!message) {
    return '';
  }
  const { content } = message;
  if (typeof content === 'string') {
    return content.trim();
  }
  return content
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n')
    .trim();
}
