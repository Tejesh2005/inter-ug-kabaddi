import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import app from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { assertSecureEnvironment, env } from './config/env.js';
import { createMatchRealtime } from './realtime/matchRealtime.js';

const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: env.clientOrigins, credentials: true },
});
const realtime = createMatchRealtime(io);
realtime.register();
app.set('realtime', realtime);

const start = async () => {
  assertSecureEnvironment();
  await connectDatabase();
  httpServer.listen(env.port, () => {
    console.log(`[server] API listening on http://localhost:${env.port}`);
  });
};

const shutdown = async (signal) => {
  console.log(`[server] ${signal} received; shutting down.`);
  io.close();
  await disconnectDatabase();
  httpServer.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  console.error('[server] Startup failed.', error);
  process.exit(1);
});
