import { Router } from 'express';
import { teamMemory } from '../memory/index.js';
import { MEMORY_MAX_BYTES, MemoryTooLargeError } from '../memory/team-memory.js';

/** Team memory shown and edited in the UI; every chat's agent reads it on each run. */
export const memoryRouter = Router();

memoryRouter.get('/', async (_req, res) => {
  res.json({ content: await teamMemory.read(), maxBytes: MEMORY_MAX_BYTES });
});

memoryRouter.put('/', async (req, res) => {
  const content = (req.body as { content?: unknown }).content;
  if (typeof content !== 'string') {
    res.status(400).json({ error: 'content must be a string' });
    return;
  }
  try {
    await teamMemory.write(content);
  } catch (err) {
    if (err instanceof MemoryTooLargeError) {
      res.status(413).json({ error: err.message });
      return;
    }
    throw err;
  }
  res.status(204).end();
});
