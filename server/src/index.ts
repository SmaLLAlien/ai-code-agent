import http from 'node:http';
import { createApp } from './app.js';
import { appConfig } from './config.js';

const app = createApp(appConfig.clientDist);
const server = http.createServer(app);

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${appConfig.port} is already in use`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(appConfig.port, () => {
  console.log(`Server listening on http://localhost:${appConfig.port}`);
  console.log(`Serving Angular app from ${appConfig.clientDist}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  // Don't hang forever on keep-alive connections.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
