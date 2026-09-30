import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { applyRaid, applyTackle, applyTechnicalPoint, startMatch } from '../src/services/scoringEngine.js';

const teamA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const teamB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const a = Array.from({ length: 7 }, (_, index) => `a${String(index + 1).padStart(23, '0')}`);
const b = Array.from({ length: 7 }, (_, index) => `b${String(index + 1).padStart(23, '0')}`);
const lineups = [
  { teamId: teamA, startingSeven: a },
  { teamId: teamB, startingSeven: b },
];
const settings = {
  halfDuration: 20,
  allOutPoints: 2,
  normalTacklePoints: 1,
  superTacklePoints: 2,
  superTackleThreshold: 3,
  superRaidMinimumPoints: 3,
  doOrDieAfterEmptyRaids: 2,
  bonusEnabled: true,
  superTackleEnabled: true,
  superRaidEnabled: true,
  doOrDieEnabled: true,
};

const match = (overrides = {}) => ({
  _id: 'cccccccccccccccccccccccc',
  teamA,
  teamB,
  status: 'live',
  currentHalf: 'first',
  currentRaidingTeam: teamA,
  currentRaider: null,
  raidNumber: 4,
  teamAScore: 0,
  teamBScore: 0,
  teamAPlayersOnCourt: a,
  teamBPlayersOnCourt: b,
  teamAOutPlayers: [],
  teamBOutPlayers: [],
  teamARevivalQueue: [],
  teamBRevivalQueue: [],
  ...overrides,
});

test('match start initializes both starting sevens and the first half', () => {
  const scheduled = match({ status: 'scheduled', currentHalf: 'not_started', raidNumber: 0, teamAPlayersOnCourt: [], teamBPlayersOnCourt: [] });
  const result = startMatch({ match: scheduled, lineups, settings });
  assert.equal(result.match.status, 'live');
  assert.equal(result.match.currentHalf, 'first');
  assert.deepEqual(result.match.teamAPlayersOnCourt, a);
  assert.equal(result.match.timerState.remainingMilliseconds, 1_200_000);
  assert.equal(result.event.type, 'MATCH_START');
});

test('empty raid advances the raid without changing score', () => {
  const result = applyRaid({ match: match(), settings, lineups, payload: { raiderId: a[0], touchedPlayerIds: [], bonus: false } });
  assert.equal(result.event.type, 'EMPTY_RAID');
  assert.equal(result.match.teamAScore, 0);
  assert.equal(result.match.raidNumber, 5);
  assert.equal(result.match.currentRaidingTeam, teamB);
  assert.equal(result.playerUpdates[0].changes['raidStats.emptyRaids'], 1);
});

test('single touch scores one, removes the defender, and records stats', () => {
  const result = applyRaid({ match: match(), settings, lineups, payload: { raiderId: a[0], touchedPlayerIds: [b[0]] } });
  assert.equal(result.match.teamAScore, 1);
  assert.ok(result.match.teamBOutPlayers.includes(b[0]));
  assert.equal(result.event.raidPoints, 1);
  assert.equal(result.playerUpdates[0].changes['raidStats.touchPoints'], 1);
});

test('multiple touches score once per distinct active defender', () => {
  const result = applyRaid({ match: match(), settings, lineups, payload: { raiderId: a[0], touchedPlayerIds: [b[0], b[1], b[2]] } });
  assert.equal(result.match.teamAScore, 3);
  assert.equal(result.event.touchedPlayers.length, 3);
  assert.equal(result.event.isSuperRaid, true);
});

test('bonus scores one without eliminating or reviving a player', () => {
  const source = match({ teamAPlayersOnCourt: a.slice(0, 6), teamAOutPlayers: [a[6]], teamARevivalQueue: [a[6]] });
  const result = applyRaid({ match: source, settings, lineups, payload: { raiderId: a[0], touchedPlayerIds: [], bonus: true } });
  assert.equal(result.event.type, 'RAID_BONUS');
  assert.equal(result.match.teamAScore, 1);
  assert.deepEqual(result.match.teamAOutPlayers, [a[6]]);
  assert.equal(result.match.teamBOutPlayers.length, 0);
});

test('touch plus bonus combines points and only touch points drive revival', () => {
  const source = match({ teamAPlayersOnCourt: a.slice(0, 5), teamAOutPlayers: [a[5], a[6]], teamARevivalQueue: [a[5], a[6]] });
  const result = applyRaid({ match: source, settings, lineups, payload: { raiderId: a[0], touchedPlayerIds: [b[0]], bonus: true } });
  assert.equal(result.event.raidPoints, 2);
  assert.equal(result.event.bonusPoint, 1);
  assert.deepEqual(result.event.playerRevivedIds, [a[5]]);
  assert.deepEqual(result.match.teamAOutPlayers, [a[6]]);
});

test('normal tackle awards configured points and sends the raider out', () => {
  const result = applyTackle({ match: match(), settings, lineups, payload: { raiderId: a[0], tacklerId: b[0], assistPlayerIds: [b[1]] } });
  assert.equal(result.event.type, 'TACKLE');
  assert.equal(result.match.teamBScore, 1);
  assert.ok(result.match.teamAOutPlayers.includes(a[0]));
  assert.equal(result.playerUpdates[1].changes['defenceStats.tacklePoints'], 1);
});

test('tackle points revive the earliest defender in its queue', () => {
  const source = match({ teamBPlayersOnCourt: b.slice(0, 6), teamBOutPlayers: [b[6]], teamBRevivalQueue: [b[6]] });
  const result = applyTackle({ match: source, settings, lineups, payload: { raiderId: a[0], tacklerId: b[0] } });
  assert.deepEqual(result.event.playerRevivedIds, [b[6]]);
  assert.equal(result.match.teamBOutPlayers.length, 0);
});

test('three or fewer defenders automatically produce a super tackle', () => {
  const source = match({ teamBPlayersOnCourt: b.slice(0, 3), teamBOutPlayers: b.slice(3), teamBRevivalQueue: b.slice(3) });
  const result = applyTackle({ match: source, settings, lineups, payload: { raiderId: a[0], tacklerId: b[0] } });
  assert.equal(result.event.type, 'SUPER_TACKLE');
  assert.equal(result.event.tacklePoints, 2);
  assert.equal(result.match.teamBScore, 2);
  assert.equal(result.playerUpdates[1].changes['defenceStats.superTackles'], 1);
});

test('touching the final defender awards all-out points and resets that lineup', () => {
  const source = match({ teamBPlayersOnCourt: [b[0]], teamBOutPlayers: b.slice(1), teamBRevivalQueue: b.slice(1) });
  const result = applyRaid({ match: source, settings, lineups, payload: { raiderId: a[0], touchedPlayerIds: [b[0]] } });
  assert.equal(result.event.type, 'ALL_OUT');
  assert.equal(result.event.allOutPoints, 2);
  assert.equal(result.match.teamAScore, 3);
  assert.deepEqual(result.match.teamBPlayersOnCourt, b);
  assert.deepEqual(result.match.teamBOutPlayers, []);
});

test('failed do-or-die empty raid becomes a tackle without a named tackler', () => {
  const result = applyRaid({ match: match(), settings, lineups, payload: { raiderId: a[0], touchedPlayerIds: [] }, consecutiveEmptyRaids: 2 });
  assert.equal(result.event.type, 'TACKLE');
  assert.equal(result.event.isDoOrDie, true);
  assert.equal(result.match.teamBScore, 1);
  assert.ok(result.match.teamAOutPlayers.includes(a[0]));
});

test('successful do-or-die raid is tracked on its event and raider statistics', () => {
  const result = applyRaid({
    match: match(), settings, lineups,
    payload: { raiderId: a[0], touchedPlayerIds: [b[0]] },
    consecutiveEmptyRaids: 2,
  });
  assert.equal(result.event.isDoOrDie, true);
  assert.equal(result.playerUpdates[0].changes['raidStats.doOrDieRaids'], 1);
  assert.equal(result.playerUpdates[0].changes['raidStats.doOrDieRaidPoints'], 1);
});

test('technical points require a reason and do not mutate player stats or raid turn', () => {
  const result = applyTechnicalPoint({ match: match(), payload: { teamId: teamB, reason: 'Official decision' } });
  assert.equal(result.match.teamBScore, 1);
  assert.equal(result.match.currentRaidingTeam, teamA);
  assert.deepEqual(result.playerUpdates, []);
  assert.throws(() => applyTechnicalPoint({ match: match(), payload: { teamId: teamA } }), /reason is required/);
});

test('disabled bonus and non-active defenders are rejected server-side', () => {
  assert.throws(() => applyRaid({ match: match(), settings: { ...settings, bonusEnabled: false }, lineups, payload: { raiderId: a[0], bonus: true } }), /disabled/);
  assert.throws(() => applyRaid({ match: match(), settings, lineups, payload: { raiderId: a[0], touchedPlayerIds: ['x'] } }), /active defenders/);
});

test('scoring is locked outside a live playing half', () => {
  assert.throws(() => applyRaid({ match: match({ status: 'halftime', currentHalf: 'halftime' }), settings, lineups, payload: { raiderId: a[0] } }), /live half/);
});

test('Mongoose ObjectIds are normalized before authoritative team comparisons', () => {
  const source = match({
    teamA: new mongoose.Types.ObjectId(teamA),
    teamB: new mongoose.Types.ObjectId(teamB),
    currentRaidingTeam: new mongoose.Types.ObjectId(teamA),
    teamAPlayersOnCourt: a.map((value) => new mongoose.Types.ObjectId(value)),
    teamBPlayersOnCourt: b.map((value) => new mongoose.Types.ObjectId(value)),
  });
  const result = applyRaid({ match: source, settings, lineups, payload: { raiderId: a[0], touchedPlayerIds: [b[0]] } });
  assert.equal(result.match.teamAScore, 1);
  assert.equal(result.match.currentRaidingTeam, teamB);
});
