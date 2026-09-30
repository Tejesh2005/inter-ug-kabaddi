import dotenv from 'dotenv';

dotenv.config();

const parsePort = (value) => {
  const port = Number(value ?? 5000);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 5000;
};

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parsePort(process.env.PORT),
  mongoUri: process.env.MONGO_URI?.trim() ?? '',
  clientUrl: process.env.CLIENT_URL?.trim() ?? 'http://localhost:5173',
  clientOrigins: (process.env.CLIENT_URL?.trim() ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean),
  jwtSecret: process.env.JWT_SECRET?.trim() || 'development-only-change-this-jwt-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || '12h',
  adminName: process.env.ADMIN_NAME?.trim() ?? '',
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? '',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  adminRole: process.env.ADMIN_ROLE?.trim() || 'SUPER_ADMIN',
});

export const isProduction = env.nodeEnv === 'production';

export const assertSecureEnvironment = () => {
  if (!isProduction) return;
  if (!process.env.JWT_SECRET || env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be explicitly configured and at least 32 characters in production');
  }
  if (!env.mongoUri) throw new Error('MONGO_URI is required in production');
  if (!env.clientOrigins.length || env.clientOrigins.some((origin) => !origin.startsWith('https://'))) {
    throw new Error('CLIENT_URL must contain one or more comma-separated HTTPS origins in production');
  }
};
