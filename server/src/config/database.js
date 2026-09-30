import mongoose from 'mongoose';
import { env, isProduction } from './env.js';

const labels = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export const getDatabaseStatus = () => {
  if (!env.mongoUri) return 'unconfigured';
  return labels[mongoose.connection.readyState] ?? 'unknown';
};

export const connectDatabase = async () => {
  if (!env.mongoUri) {
    console.warn('[database] MONGO_URI is not configured; API started without persistence.');
    return false;
  }

  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`[database] Connected to ${mongoose.connection.name}.`);
    return true;
  } catch (error) {
    console.error(`[database] Connection failed: ${error.message}`);
    if (isProduction) throw error;
    return false;
  }
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};
