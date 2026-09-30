import { randomUUID } from 'node:crypto';
import { type AGUIEvent, EventType, type RunAgentInput } from '@ag-ui/core';
import { EventEncoder } from '@ag-ui/encoder';
import { Router } from 'express';
import { PiToAgUiTranslator } from '../agui/pi-to-agui.js';
import { chatRegistry } from '../chats/chat.registry.js';

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
  send({ type: EventType.RUN_STARTED, threadId, runId });

  const translator = new PiToAgUiTranslator();
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
