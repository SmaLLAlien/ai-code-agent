import path from 'node:path';
import compression from 'compression';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { apiRouter } from './routes/api.js';

/** Angular build output file names contain an 8-char content hash, e.g. `main-ABCD1234.js`. */
const HASHED_FILE = /-[A-Z0-9]{8}\.[a-z0-9]+$/;

export function createApp(clientDist: string): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(compression());

  app.use('/api', apiRouter);

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

  const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    console.error(err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  };
  app.use(errorHandler);

  return app;
}
