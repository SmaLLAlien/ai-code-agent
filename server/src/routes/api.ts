import { Router } from 'express';
import { chatsRouter } from './chats.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use('/chats', chatsRouter);

// Unknown API routes answer with JSON instead of falling through to the static handler.
apiRouter.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});
