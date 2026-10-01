import { STATUS_CODES } from 'node:http';
import path from 'node:path';
import compression from 'compression';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { apiRouter } from './routes/api.js';

/** Angular build output file names contain an 8-char content hash, e.g. `main-ABCD1234.js`. */
const HASHED_FILE = /-[A-Z0-9]{8}\.[a-z0-9]+$/;

export function createApp(clientDist: string): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    compression({
      // compression buffers the body; an SSE stream must reach the client event by event.
      filter: (req, res) =>
        !String(res.getHeader('Content-Type') ?? '').startsWith('text/event-stream') &&
        compression.filter(req, res),
    }),
  );

  app.use('/api', express.json({ limit: '1mb' }), apiRouter);

  app.use(
    express.static(clientDist, {
      setHeaders: (res, filePath) => {
        // Hashed bundles never change -> cache forever; everything else (index.html,
        // favicon, public assets) must be revalidated so new deploys are picked up.
        const cacheControl = HASHED_FILE.test(path.basename(filePath))
          ? 'public, max-age=31536000, immutable'
          : 'no-cache';
        res.setHeader('Cache-Control', cacheControl);
      },
    }),
  );

  // SPA fallback: client-side routes (e.g. /chat/:id) get index.html so a page reload works.
  // Only page navigations qualify - /api is handled above and missing files (with an extension) stay 404.
  app.use((req, res, next) => {
    const isPage =
      (req.method === 'GET' || req.method === 'HEAD') &&
      !path.extname(req.path) &&
      req.accepts('html') === 'html';
    if (!isPage) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next(err));
  });

  const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    // Client errors raised by middleware (e.g. malformed JSON from express.json) keep their status.
    const status = (err as { status?: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status).json({ error: STATUS_CODES[status] ?? 'Bad Request' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  };
  app.use(errorHandler);

  return app;
}
