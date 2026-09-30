import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import request from 'supertest';
import { createAuthRoutes } from '../src/routes/authRoutes.js';
import { authorizeRoles, requireAuth } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { hashPassword, verifyPassword } from '../src/services/passwordService.js';
import { createAccessToken, verifyAccessToken } from '../src/services/tokenService.js';

const testAdmin = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Tournament Admin',
  email: 'admin@college.edu',
  role: 'SUPER_ADMIN',
};

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', createAuthRoutes({
    authenticateAdmin: async (email, password) => {
      if (email.toLowerCase() !== testAdmin.email || password !== 'correct-password') {
        throw Object.assign(new Error('Invalid email or password'), { status: 401 });
      }
      return testAdmin;
    },
  }));
  app.get('/super-only', requireAuth, authorizeRoles('SUPER_ADMIN'), (_request, response) => response.json({ success: true }));
  app.get('/scorer-only', requireAuth, authorizeRoles('SCORER'), (_request, response) => response.json({ success: true }));
  app.use(errorHandler);
  return app;
};

test('password service hashes and verifies without storing plaintext', async () => {
  const hash = await hashPassword('safe-password');
  assert.notEqual(hash, 'safe-password');
  assert.equal(await verifyPassword('safe-password', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('token service signs verifiable identity and rejects tampering', () => {
  const token = createAccessToken(testAdmin);
  const payload = verifyAccessToken(token);
  assert.equal(payload.sub, testAdmin._id.toString());
  assert.equal(payload.role, 'SUPER_ADMIN');
  assert.throws(() => verifyAccessToken(`${token}tampered`));
});

test('login, authenticated profile, and logout complete the cookie flow', async () => {
  const agent = request.agent(createTestApp());
  const login = await agent.post('/api/auth/login').send({ email: 'ADMIN@COLLEGE.EDU', password: 'correct-password' });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.admin.role, 'SUPER_ADMIN');
  assert.match(login.headers['set-cookie'][0], /interug_token=/);
  assert.match(login.headers['set-cookie'][0], /HttpOnly/);

  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.data.admin.email, testAdmin.email);

  const logout = await agent.post('/api/auth/logout');
  assert.equal(logout.status, 200);
  const afterLogout = await agent.get('/api/auth/me');
  assert.equal(afterLogout.status, 401);
});

test('login uses generic errors and validates required fields', async () => {
  const app = createTestApp();
  const missing = await request(app).post('/api/auth/login').send({ email: '' });
  assert.equal(missing.status, 400);

  const invalid = await request(app).post('/api/auth/login').send({ email: 'admin@college.edu', password: 'wrong' });
  assert.equal(invalid.status, 401);
  assert.equal(invalid.body.message, 'Invalid email or password');
});

test('protected routes enforce authentication and roles', async () => {
  const app = createTestApp();
  assert.equal((await request(app).get('/super-only')).status, 401);

  const token = createAccessToken(testAdmin);
  assert.equal((await request(app).get('/super-only').set('Authorization', `Bearer ${token}`)).status, 200);
  assert.equal((await request(app).get('/scorer-only').set('Authorization', `Bearer ${token}`)).status, 403);
});
