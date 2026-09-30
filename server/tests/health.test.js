import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

test('GET /api/health returns API and database status', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, 'ok');
  assert.match(response.body.data.database, /^(connected|connecting|disconnected|disconnecting|unconfigured|unknown)$/);
});

test('unknown API routes return structured JSON', async () => {
  const response = await request(app).get('/api/missing');

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /Route not found/);
});
