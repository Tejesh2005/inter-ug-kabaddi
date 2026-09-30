import test from 'node:test';
import assert from 'node:assert/strict';
import { currentTimerRemaining, endFirstHalf, endMatch, pauseTimer, reopenMatch, runTimer, startSecondHalf } from '../src/services/matchLifecycleEngine.js';

const now = new Date('2026-10-03T10:00:00.000Z');
const teamA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const teamB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const match = (overrides = {}) => ({
  status: 'live', currentHalf: 'first', teamA, teamB, teamAScore: 17, teamBScore: 13,
  firstHalfTeamAScore: 0, firstHalfTeamBScore: 0, secondHalfTeamAScore: 0, secondHalfTeamBScore: 0,
  currentRaider: 'cccccccccccccccccccccccc', winner: null, resultText: '', endedAt: null,
  timerState: { status: 'stopped', remainingMilliseconds: 1_200_000, startedAt: null, pausedAt: null },
  ...overrides,
});

test('running timer derives visible time without per-second database writes', () => {
  const timer = { status: 'running', remainingMilliseconds: 600_000, startedAt: new Date(now.getTime() - 45_000) };
  assert.equal(currentTimerRemaining(timer, now), 555_000);
  assert.equal(currentTimerRemaining({ ...timer, startedAt: new Date(now.getTime() + 5_000) }, now), 600_000);
});

test('timer start, pause, and resume preserve authoritative remaining time', () => {
  const started = runTimer({ match: match(), now });
  assert.equal(started.event.type, 'TIMER_START');
  assert.equal(started.match.timerState.status, 'running');
  const paused = pauseTimer({ match: started.match, now: new Date(now.getTime() + 31_250) });
  assert.equal(paused.match.timerState.remainingMilliseconds, 1_168_750);
  const resumed = runTimer({ match: paused.match, now: new Date(now.getTime() + 60_000) });
  assert.equal(resumed.event.type, 'TIMER_RESUME');
  assert.equal(resumed.match.timerState.remainingMilliseconds, 1_168_750);
});

test('timer transitions reject invalid states and an expired timer', () => {
  assert.throws(() => pauseTimer({ match: match(), now }), /running timer/);
  assert.throws(() => runTimer({ match: match({ status: 'halftime', currentHalf: 'halftime' }), now }), /live half/);
  assert.throws(() => runTimer({ match: match({ timerState: { status: 'paused', remainingMilliseconds: 0 } }), now }), /reached zero/);
});

test('first half end snapshots scores and locks ordinary live play', () => {
  const result = endFirstHalf({ match: match(), now });
  assert.equal(result.match.status, 'halftime');
  assert.equal(result.match.currentHalf, 'halftime');
  assert.equal(result.match.firstHalfTeamAScore, 17);
  assert.equal(result.match.firstHalfTeamBScore, 13);
  assert.equal(result.match.timerState.status, 'stopped');
  assert.equal(result.event.type, 'FIRST_HALF_END');
});

test('second half starts with a fresh configured timer', () => {
  const halftime = endFirstHalf({ match: match(), now }).match;
  const result = startSecondHalf({ match: halftime, halfDuration: 20, now });
  assert.equal(result.match.status, 'live');
  assert.equal(result.match.currentHalf, 'second');
  assert.equal(result.match.timerState.remainingMilliseconds, 1_200_000);
  assert.equal(result.event.type, 'SECOND_HALF_START');
});

test('match completion calculates winner and second-half scores', () => {
  const source = match({
    currentHalf: 'second', teamAScore: 34, teamBScore: 29, firstHalfTeamAScore: 17, firstHalfTeamBScore: 13,
    timerState: { status: 'running', remainingMilliseconds: 60_000, startedAt: new Date(now.getTime() - 20_000) },
  });
  const result = endMatch({ match: source, now });
  assert.equal(result.match.status, 'completed');
  assert.equal(result.match.winner, teamA);
  assert.equal(result.match.secondHalfTeamAScore, 17);
  assert.equal(result.match.secondHalfTeamBScore, 16);
  assert.equal(result.match.timerState.remainingMilliseconds, 40_000);
  assert.equal(result.match.resultText, '5 point win');
});

test('draw completion stores no winner', () => {
  const result = endMatch({ match: match({ currentHalf: 'second', teamAScore: 27, teamBScore: 27 }), now });
  assert.equal(result.match.winner, null);
  assert.equal(result.match.resultText, 'Match drawn');
});

test('reopen restores the second-half state and pauses the timer', () => {
  const beforeEnd = match({ currentHalf: 'second', teamAScore: 34, teamBScore: 29, timerState: { status: 'paused', remainingMilliseconds: 42_000 } });
  const completed = endMatch({ match: beforeEnd, now }).match;
  const result = reopenMatch({ match: completed, previousState: beforeEnd });
  assert.equal(result.match.status, 'live');
  assert.equal(result.match.currentHalf, 'second');
  assert.equal(result.match.winner, null);
  assert.equal(result.match.timerState.status, 'paused');
  assert.equal(result.match.timerState.remainingMilliseconds, 42_000);
});
