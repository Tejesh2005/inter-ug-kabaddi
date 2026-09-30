import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { validateFixtureDetails } from '../src/services/matchService.js';

const tournament = { startDate: new Date('2026-10-01'), endDate: new Date('2026-10-05') };
const teamA = new mongoose.Types.ObjectId();
const teamB = new mongoose.Types.ObjectId();

test('fixture validation accepts active, distinct teams inside tournament dates', () => {
  assert.doesNotThrow(() => validateFixtureDetails({
    tournament, teamAExists: true, teamBExists: true,
    payload: { teamA, teamB, scheduledDate: '2026-10-03' },
  }));
});

test('fixture validation rejects self-play and missing teams', () => {
  assert.throws(() => validateFixtureDetails({
    tournament, teamAExists: true, teamBExists: true,
    payload: { teamA, teamB: teamA, scheduledDate: '2026-10-03' },
  }), /cannot play itself/);
  assert.throws(() => validateFixtureDetails({
    tournament, teamAExists: true, teamBExists: false,
    payload: { teamA, teamB, scheduledDate: '2026-10-03' },
  }), /were not found/);
});

test('fixture validation enforces tournament date boundaries', () => {
  assert.throws(() => validateFixtureDetails({
    tournament, teamAExists: true, teamBExists: true,
    payload: { teamA, teamB, scheduledDate: '2026-09-30' },
  }), /within the tournament schedule/);
  assert.doesNotThrow(() => validateFixtureDetails({
    tournament, teamAExists: true, teamBExists: true,
    payload: { teamA, teamB, scheduledDate: '2026-10-05' },
  }));
});
