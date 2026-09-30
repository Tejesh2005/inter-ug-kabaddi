import test from 'node:test';
import assert from 'node:assert/strict';
import { applyScoreCorrection, reverseMatchEvent } from '../src/services/eventEngine.js';

const teamA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const teamB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const player = 'cccccccccccccccccccccccc';
const baseMatch = { teamA, teamB, status: 'live', currentHalf: 'first', teamAScore: 12, teamBScore: 10, raidNumber: 8, currentRaidingTeam: teamA, teamAPlayersOnCourt: [player], teamAOutPlayers: [], teamARevivalQueue: [] };

test('score correction applies a signed adjustment and creates an auditable description', () => {
  const result = applyScoreCorrection({ match: baseMatch, payload: { teamId: teamB, adjustment: 2, reason: 'Referee review' } });
  assert.equal(result.match.teamBScore, 12);
  assert.equal(result.event.teamBPointsChange, 2);
  assert.equal(result.event.type, 'SCORE_CORRECTION');
  assert.match(result.event.description, /Referee review/);
});

test('score correction requires a reason and cannot produce a negative score', () => {
  assert.throws(() => applyScoreCorrection({ match: baseMatch, payload: { teamId: teamA, adjustment: 1 } }), /reason is required/);
  assert.throws(() => applyScoreCorrection({ match: baseMatch, payload: { teamId: teamB, adjustment: -11, reason: 'Data fix' } }), /negative/);
  assert.throws(() => applyScoreCorrection({ match: baseMatch, payload: { teamId: teamA, adjustment: 0, reason: 'No change' } }), /non-zero integer/);
});

test('event reversal restores the complete previous match state', () => {
  const event = { previousState: { teamAScore: 10, teamBScore: 10, raidNumber: 7, currentRaidingTeam: teamB, teamAPlayersOnCourt: [], teamAOutPlayers: [player], teamARevivalQueue: [player] }, playerStatChanges: [] };
  const result = reverseMatchEvent({ match: baseMatch, event });
  assert.equal(result.match.teamAScore, 10);
  assert.equal(result.match.raidNumber, 7);
  assert.equal(result.match.currentRaidingTeam, teamB);
  assert.deepEqual(result.match.teamAOutPlayers, [player]);
});

test('event reversal generates exact inverse nested player-stat updates', () => {
  const event = { previousState: { teamAScore: 11 }, playerStatChanges: [{ playerId: player, changes: { 'raidStats.totalRaids': 1, 'raidStats.raidPoints': 3, totalPoints: 3 } }] };
  const result = reverseMatchEvent({ match: baseMatch, event });
  assert.deepEqual(result.playerUpdates, [{ playerId: player, changes: { 'raidStats.totalRaids': -1, 'raidStats.raidPoints': -3, totalPoints: -3 } }]);
});

test('event reversal rejects legacy events without a state snapshot', () => {
  assert.throws(() => reverseMatchEvent({ match: baseMatch, event: {} }), /reversible state/);
});
