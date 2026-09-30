import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import request from 'supertest';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createManagementRoutes } from '../src/routes/managementRoutes.js';
import { createAccessToken } from '../src/services/tokenService.js';

const ids = {
  tournament: new mongoose.Types.ObjectId().toString(),
  team: new mongoose.Types.ObjectId().toString(),
  player: new mongoose.Types.ObjectId().toString(),
  match: new mongoose.Types.ObjectId().toString(),
};

const superToken = createAccessToken({
  _id: new mongoose.Types.ObjectId(), name: 'Super Admin', email: 'admin@college.edu', role: 'SUPER_ADMIN',
});
const scorerToken = createAccessToken({
  _id: new mongoose.Types.ObjectId(), name: 'Match Scorer', email: 'scorer@college.edu', role: 'SCORER',
});

const calls = [];
const services = {
  tournament: {
    list: async () => [{ _id: ids.tournament, name: 'Inter UG Championship' }],
    getById: async (id) => ({ _id: id, name: 'Inter UG Championship' }),
    create: async (body) => { calls.push(['tournament.create', body]); return { _id: ids.tournament, ...body }; },
    update: async (id, body) => ({ _id: id, ...body }),
  },
  team: {
    list: async () => [{ _id: ids.team, name: 'UG1' }],
    getById: async (id) => ({ _id: id, name: 'UG1', players: [] }),
    create: async (body) => { calls.push(['team.create', body]); return { _id: ids.team, ...body }; },
    update: async (id, body) => ({ _id: id, ...body }),
    remove: async (id) => ({ _id: id, name: 'UG1' }),
  },
  player: {
    list: async (filter) => { calls.push(['player.list', filter]); return []; },
    getById: async (id) => ({ _id: id, name: 'Rahul' }),
    create: async (body) => ({ _id: ids.player, ...body }),
    update: async (id, body) => ({ _id: id, ...body }),
    remove: async (id) => ({ _id: id, name: 'Rahul' }),
  },
  match: {
    list: async (filter) => { calls.push(['match.list', filter]); return []; },
    getById: async (id) => ({ _id: id, matchNumber: 1 }),
    create: async (body) => ({ _id: ids.match, ...body }),
    update: async (id, body) => ({ _id: id, ...body }),
  },
  lineup: {
    get: async (id) => ({ match: { _id: id }, lineups: [], firstRaidingTeam: null }),
    save: async (id, body) => ({ match: { _id: id }, lineups: [body.teamA, body.teamB], firstRaidingTeam: body.firstRaidingTeam }),
  },
  scoring: {
    start: async (id, body, adminId) => ({ match: { _id: id, status: 'live' }, event: { type: 'MATCH_START' }, body, adminId }),
    raid: async (id, body, adminId) => ({ match: { _id: id, teamAScore: 1 }, event: { type: 'RAID_TOUCH' }, body, adminId }),
    tackle: async (id, body, adminId) => ({ match: { _id: id, teamBScore: 1 }, event: { type: 'TACKLE' }, body, adminId }),
    technicalPoint: async (id, body, adminId) => ({ match: { _id: id }, event: { type: 'TECHNICAL_POINT' }, body, adminId }),
  },
  audit: {
    latest: async (id) => ({ _id: new mongoose.Types.ObjectId().toString(), matchId: id, type: 'RAID_TOUCH' }),
    list: async (id) => [{ _id: new mongoose.Types.ObjectId().toString(), matchId: id, type: 'RAID_TOUCH' }],
    undo: async (id, body, adminId) => ({ match: { _id: id, teamAScore: 0 }, event: { type: 'UNDO' }, body, adminId }),
    correction: async (id, body, adminId) => ({ match: { _id: id, teamAScore: 2 }, event: { type: 'SCORE_CORRECTION' }, body, adminId }),
  },
  lifecycle: {
    runTimer: async (id, body, adminId) => ({ match: { _id: id, timerState: { status: 'running' } }, event: { type: 'TIMER_START' }, body, adminId }),
    pauseTimer: async (id, body, adminId) => ({ match: { _id: id, timerState: { status: 'paused' } }, event: { type: 'TIMER_PAUSE' }, body, adminId }),
    endFirstHalf: async (id, body, adminId) => ({ match: { _id: id, status: 'halftime' }, event: { type: 'FIRST_HALF_END' }, body, adminId }),
    startSecondHalf: async (id, body, adminId) => ({ match: { _id: id, currentHalf: 'second' }, event: { type: 'SECOND_HALF_START' }, body, adminId }),
    endMatch: async (id, body, adminId) => ({ match: { _id: id, status: 'completed' }, event: { type: 'MATCH_END' }, body, adminId }),
    reopen: async (id, body, adminId) => ({ match: { _id: id, status: 'live' }, event: { type: 'MATCH_REOPEN' }, body, adminId }),
  },
};

const createTestApp = (realtime) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  if (realtime) app.set('realtime', realtime);
  app.use('/api', createManagementRoutes(services));
  app.use(errorHandler);
  return app;
};

test('public management reads return structured collections and records', async () => {
  const app = createTestApp();
  const tournaments = await request(app).get('/api/tournaments');
  const team = await request(app).get(`/api/teams/${ids.team}`);
  const players = await request(app).get(`/api/players?teamId=${ids.team}`);

  assert.equal(tournaments.status, 200);
  assert.equal(tournaments.body.data.tournaments.length, 1);
  assert.equal(team.body.data.team.name, 'UG1');
  assert.equal(players.status, 200);
  assert.deepEqual(calls.at(-1), ['player.list', { teamId: ids.team }]);
});

test('management writes require a SUPER_ADMIN token', async () => {
  const app = createTestApp();
  const payload = { name: 'UG2' };

  assert.equal((await request(app).post('/api/teams').send(payload)).status, 401);
  assert.equal((await request(app).post('/api/teams').set('Authorization', `Bearer ${scorerToken}`).send(payload)).status, 403);

  const created = await request(app).post('/api/teams').set('Authorization', `Bearer ${superToken}`).send(payload);
  assert.equal(created.status, 201);
  assert.equal(created.body.data.team.name, 'UG2');
});

test('tournament, team, and player update/delete routes pass correct identifiers', async () => {
  const app = createTestApp();
  const auth = { Authorization: `Bearer ${superToken}` };

  const tournament = await request(app).put(`/api/tournaments/${ids.tournament}`).set(auth).send({ status: 'live' });
  const team = await request(app).put(`/api/teams/${ids.team}`).set(auth).send({ name: 'UG One' });
  const player = await request(app).put(`/api/players/${ids.player}`).set(auth).send({ jerseyNumber: 9 });
  const removed = await request(app).delete(`/api/players/${ids.player}`).set(auth);

  assert.equal(tournament.body.data.tournament.status, 'live');
  assert.equal(team.body.data.team.name, 'UG One');
  assert.equal(player.body.data.player.jerseyNumber, 9);
  assert.equal(removed.status, 200);
});

test('invalid resource identifiers are rejected before service execution', async () => {
  const response = await request(createTestApp()).get('/api/teams/not-an-object-id');
  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Invalid id');
});

test('match routes support status filters and protected fixture writes', async () => {
  const app = createTestApp();
  const filtered = await request(app).get(`/api/matches?filter=upcoming&tournamentId=${ids.tournament}`);
  assert.equal(filtered.status, 200);
  assert.deepEqual(calls.at(-1), ['match.list', { filter: 'upcoming', tournamentId: ids.tournament }]);

  const payload = { tournamentId: ids.tournament, teamA: ids.team, teamB: new mongoose.Types.ObjectId().toString(), matchNumber: 4 };
  assert.equal((await request(app).post('/api/matches').send(payload)).status, 401);
  const created = await request(app).post('/api/matches').set('Authorization', `Bearer ${superToken}`).send(payload);
  assert.equal(created.status, 201);
  assert.equal(created.body.data.match.matchNumber, 4);
});

test('lineup routes allow scorers and super admins but reject public access', async () => {
  const app = createTestApp();
  const endpoint = `/api/matches/${ids.match}/lineups`;
  assert.equal((await request(app).get(endpoint)).status, 401);
  assert.equal((await request(app).get(endpoint).set('Authorization', `Bearer ${scorerToken}`)).status, 200);

  const body = { teamA: { startingSeven: [] }, teamB: { startingSeven: [] }, firstRaidingTeam: ids.team };
  const saved = await request(app).post(endpoint).set('Authorization', `Bearer ${scorerToken}`).send(body);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.lineups.length, 2);
});

test('scoring action routes require scorer access and forward authenticated admin identity', async () => {
  const app = createTestApp();
  const endpoint = `/api/matches/${ids.match}/raid`;
  assert.equal((await request(app).post(endpoint).send({})).status, 401);
  const scored = await request(app).post(endpoint).set('Authorization', `Bearer ${scorerToken}`).send({
    actionId: 'b20e9d34-1b25-4b0e-9f42-0fc91e50a4e3', raiderId: ids.player, touchedPlayerIds: [],
  });
  assert.equal(scored.status, 200);
  assert.equal(scored.body.data.event.type, 'RAID_TOUCH');
  assert.equal(scored.body.data.adminId, String(JSON.parse(Buffer.from(scorerToken.split('.')[1], 'base64url')).sub));
});

test('completed scoring actions broadcast their authoritative match state', async () => {
  const broadcasts = [];
  const app = createTestApp({ broadcast: (payload) => broadcasts.push(payload) });
  const response = await request(app).post(`/api/matches/${ids.match}/raid`).set('Authorization', `Bearer ${scorerToken}`).send({
    actionId: 'e99001df-dd26-43b4-9e97-a251b7e63099', raiderId: ids.player, touchedPlayerIds: [],
  });

  assert.equal(response.status, 200);
  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].match._id, ids.match);
  assert.equal(broadcasts[0].event.type, 'RAID_TOUCH');
});

test('undo and correction allow scorers while full audit history requires super admin', async () => {
  const app = createTestApp();
  const base = `/api/matches/${ids.match}`;
  const action = { actionId: 'b20e9d34-1b25-4b0e-9f42-0fc91e50a4e3' };
  assert.equal((await request(app).post(`${base}/undo`).send(action)).status, 401);
  assert.equal((await request(app).post(`${base}/undo`).set('Authorization', `Bearer ${scorerToken}`).send(action)).body.data.event.type, 'UNDO');
  assert.equal((await request(app).post(`${base}/correction`).set('Authorization', `Bearer ${scorerToken}`).send({ ...action, adjustment: 2 })).body.data.event.type, 'SCORE_CORRECTION');
  assert.equal((await request(app).get(`${base}/events/latest`).set('Authorization', `Bearer ${scorerToken}`)).status, 200);
  assert.equal((await request(app).get(`${base}/events`).set('Authorization', `Bearer ${scorerToken}`)).status, 403);
  assert.equal((await request(app).get(`${base}/events`).set('Authorization', `Bearer ${superToken}`)).body.data.events.length, 1);
});

test('match lifecycle controls allow scorers while reopen requires super admin', async () => {
  const app = createTestApp();
  const base = `/api/matches/${ids.match}`;
  const action = { actionId: '69bdc729-43db-4474-bc04-e6bbfb557d7e' };
  const scorerAuth = { Authorization: `Bearer ${scorerToken}` };
  const superAuth = { Authorization: `Bearer ${superToken}` };

  assert.equal((await request(app).post(`${base}/timer/start`).send(action)).status, 401);
  assert.equal((await request(app).post(`${base}/timer/start`).set(scorerAuth).send(action)).body.data.event.type, 'TIMER_START');
  assert.equal((await request(app).post(`${base}/timer/pause`).set(scorerAuth).send(action)).body.data.event.type, 'TIMER_PAUSE');
  assert.equal((await request(app).post(`${base}/timer/resume`).set(scorerAuth).send(action)).status, 200);
  assert.equal((await request(app).post(`${base}/first-half/end`).set(scorerAuth).send(action)).body.data.match.status, 'halftime');
  assert.equal((await request(app).post(`${base}/second-half/start`).set(scorerAuth).send(action)).body.data.match.currentHalf, 'second');
  assert.equal((await request(app).post(`${base}/end`).set(scorerAuth).send(action)).body.data.match.status, 'completed');
  assert.equal((await request(app).post(`${base}/reopen`).set(scorerAuth).send(action)).status, 403);
  assert.equal((await request(app).post(`${base}/reopen`).set(superAuth).send(action)).body.data.event.type, 'MATCH_REOPEN');
});
