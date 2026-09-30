import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import Admin from '../src/models/Admin.js';
import { hashPassword } from '../src/services/passwordService.js';

const validRoles = ['SUPER_ADMIN', 'SCORER'];

const createAdmin = async () => {
  if (!env.mongoUri) throw new Error('MONGO_URI is required');
  if (!env.adminName || !env.adminEmail || env.adminPassword.length < 10) {
    throw new Error('ADMIN_NAME, ADMIN_EMAIL, and an ADMIN_PASSWORD of at least 10 characters are required');
  }
  if (!validRoles.includes(env.adminRole)) throw new Error('ADMIN_ROLE must be SUPER_ADMIN or SCORER');

  const connected = await connectDatabase();
  if (!connected) throw new Error('Could not connect to MongoDB');

  const passwordHash = await hashPassword(env.adminPassword);
  const admin = await Admin.findOneAndUpdate(
    { email: env.adminEmail },
    { name: env.adminName, email: env.adminEmail, passwordHash, role: env.adminRole },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  console.log(`[admin] ${admin.email} is ready with role ${admin.role}.`);
};

try {
  await createAdmin();
} catch (error) {
  console.error(`[admin] ${error.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
