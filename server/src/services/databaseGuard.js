import mongoose from 'mongoose';
import { createHttpError } from '../utils/httpError.js';

export const requireDatabaseConnection = () => {
  if (mongoose.connection.readyState !== 1) {
    throw createHttpError(503, 'Database is temporarily unavailable');
  }
};
