import Admin from '../models/Admin.js';
import { createHttpError } from '../utils/httpError.js';
import { requireDatabaseConnection } from './databaseGuard.js';
import { verifyPassword } from './passwordService.js';

export const authenticateAdmin = async (email, password) => {
  try {
    requireDatabaseConnection();
  } catch {
    throw createHttpError(503, 'Authentication is temporarily unavailable');
  }

  const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  const validPassword = admin && await verifyPassword(password, admin.passwordHash);
  if (!validPassword) throw createHttpError(401, 'Invalid email or password');

  return admin;
};
