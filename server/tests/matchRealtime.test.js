import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchRealtime, isMatchId, matchRoom } from '../src/realtime/matchRealtime.js';

const createIo = () => {
  const handlers = new Map();
  const emissions = [];
  return {
    handlers,
    emissions,
    on: (name, handler) => handlers.set(name, handler),
    to: (room) => ({ emit: (name, payload) => emissions.push({ room, name, payload }) }),
  };
};

test('match rooms use a dedicated predictable name and validate object ids', () => {
  assert.equal(matchRoom('a'.repeat(24)), `match:${'a'.repeat(24)}`);
  assert.equal(isMatchId('a'.repeat(24)), true);
  assert.equal(isMatchId('not-a-match'), false);
});

test('realtime hub broadcasts authoritative state and targeted updates to one match room', () => {
  const io = createIo();
  const realtime = createMatchRealtime(io);
  realtime.broadcast({ match: { _id: 'a'.repeat(24), teamAScore: 22, teamBScore: 20 }, event: { type: 'RAID_TOUCH', teamAPointsChange: 2, teamBPointsChange: 0 } });
  assert.deepEqual(io.emissions.map((item) => item.name), ['match:state', 'match:update', 'score:update', 'raid:update', 'player:update']);
  assert.ok(io.emissions.every((item) => item.room === matchRoom('a'.repeat(24))));
  realtime.broadcast({ match: { _id: 'a'.repeat(24) }, event: { type: 'TIMER_PAUSE', teamAPointsChange: 0, teamBPointsChange: 0 } });
  assert.equal(io.emissions.at(-1).name, 'timer:update');
});

test('realtime hub joins and leaves only valid match rooms', () => {
  const io = createIo();
  const realtime = createMatchRealtime(io);
  const handlers = new Map();
  const joined = [];
  const left = [];
  const socket = { emit: () => {}, on: (name, handler) => handlers.set(name, handler), join: (room) => joined.push(room), leave: (room) => left.push(room) };
  realtime.register();
  io.handlers.get('connection')(socket);
  let acknowledgement;
  handlers.get('match:join')('a'.repeat(24), (result) => { acknowledgement = result; });
  assert.deepEqual(joined, [matchRoom('a'.repeat(24))]);
  assert.deepEqual(acknowledgement, { ok: true, matchId: 'a'.repeat(24) });
  handlers.get('match:leave')('a'.repeat(24));
  assert.deepEqual(left, [matchRoom('a'.repeat(24))]);
});
