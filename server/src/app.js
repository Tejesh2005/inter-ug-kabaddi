import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import managementRoutes from './routes/managementRoutes.js';
import publicRoutes from './routes/publicRoutes.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use((_request, response, next) => {
    response.set({
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/', (_request, response) => {
    response.json({ name: 'Inter UG Kabaddi API', health: '/api/health' });
  });
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api', managementRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export default createApp();
