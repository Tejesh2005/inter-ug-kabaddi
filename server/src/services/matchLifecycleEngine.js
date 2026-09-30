import { createHttpError } from '../utils/httpError.js';

// JSON cloning normalizes Mongoose ObjectIds. Mongoose casts dates back when
// the calculated state is persisted.
const clone = (value) => JSON.parse(JSON.stringify(value));
const id = (value) => value?.toString();

const requireMatch = (match) => {
  if (!match) throw createHttpError(404, 'Match not found');
};

const requireLiveHalf = (match) => {
  requireMatch(match);
  if (match.status !== 'live' || !['first', 'second'].includes(match.currentHalf)) {
    throw createHttpError(409, 'Timer controls are available only during a live half');
  }
};

const scoreChanges = (before, after) => ({
  teamAPointsChange: 0,
  teamBPointsChange: 0,
  teamAScoreAfter: after.teamAScore,
  teamBScoreAfter: after.teamBScore,
});

export const currentTimerRemaining = (timerState = {}, now = new Date()) => {
  const stored = Math.max(0, Number(timerState.remainingMilliseconds) || 0);
  if (timerState.status !== 'running' || !timerState.startedAt) return stored;
  return Math.max(0, stored - Math.max(0, now.getTime() - new Date(timerState.startedAt).getTime()));
};

export const runTimer = ({ match: source, now = new Date() }) => {
  requireLiveHalf(source);
  if (source.timerState?.status === 'running') throw createHttpError(409, 'Timer is already running');
  const remainingMilliseconds = currentTimerRemaining(source.timerState, now);
  if (remainingMilliseconds <= 0) throw createHttpError(409, 'Timer has reached zero');
  const match = clone(source);
  const resumed = source.timerState?.status === 'paused';
  match.timerState = { status: 'running', remainingMilliseconds, startedAt: now, pausedAt: null };
  return {
    match,
    event: {
      type: resumed ? 'TIMER_RESUME' : 'TIMER_START',
      description: resumed ? 'Match timer resumed' : 'Match timer started',
      ...scoreChanges(source, match),
    },
  };
};

export const pauseTimer = ({ match: source, now = new Date() }) => {
  requireLiveHalf(source);
  if (source.timerState?.status !== 'running') throw createHttpError(409, 'Only a running timer can be paused');
  const match = clone(source);
  match.timerState = {
    status: 'paused',
    remainingMilliseconds: currentTimerRemaining(source.timerState, now),
    startedAt: source.timerState.startedAt,
    pausedAt: now,
  };
  return { match, event: { type: 'TIMER_PAUSE', description: 'Match timer paused', ...scoreChanges(source, match) } };
};

export const endFirstHalf = ({ match: source, now = new Date() }) => {
  requireMatch(source);
  if (source.status !== 'live' || source.currentHalf !== 'first') throw createHttpError(409, 'Only the first half can be ended');
  const match = clone(source);
  match.status = 'halftime';
  match.currentHalf = 'halftime';
  match.firstHalfTeamAScore = source.teamAScore;
  match.firstHalfTeamBScore = source.teamBScore;
  match.currentRaider = null;
  match.timerState = { status: 'stopped', remainingMilliseconds: 0, startedAt: null, pausedAt: now };
  return { match, event: { type: 'FIRST_HALF_END', description: 'First half ended', ...scoreChanges(source, match) } };
};

export const startSecondHalf = ({ match: source, halfDuration, now = new Date() }) => {
  requireMatch(source);
  if (source.status !== 'halftime' || source.currentHalf !== 'halftime') throw createHttpError(409, 'Match must be at halftime');
  if (!Number.isInteger(halfDuration) || halfDuration <= 0) throw createHttpError(500, 'Tournament half duration is invalid');
  const match = clone(source);
  match.status = 'live';
  match.currentHalf = 'second';
  match.currentRaider = null;
  match.secondHalfTeamAScore = 0;
  match.secondHalfTeamBScore = 0;
  match.timerState = { status: 'stopped', remainingMilliseconds: halfDuration * 60_000, startedAt: null, pausedAt: null };
  return { match, event: { type: 'SECOND_HALF_START', description: 'Second half started', ...scoreChanges(source, match), timestamp: now } };
};

export const endMatch = ({ match: source, now = new Date() }) => {
  requireMatch(source);
  if (source.status !== 'live' || source.currentHalf !== 'second') throw createHttpError(409, 'Match can be ended only during the second half');
  const match = clone(source);
  const aWon = source.teamAScore > source.teamBScore;
  const bWon = source.teamBScore > source.teamAScore;
  match.status = 'completed';
  match.currentHalf = 'completed';
  match.currentRaider = null;
  match.secondHalfTeamAScore = Math.max(0, source.teamAScore - source.firstHalfTeamAScore);
  match.secondHalfTeamBScore = Math.max(0, source.teamBScore - source.firstHalfTeamBScore);
  match.winner = aWon ? id(source.teamA) : bWon ? id(source.teamB) : null;
  match.resultText = aWon
    ? `${source.teamAScore - source.teamBScore} point win`
    : bWon
      ? `${source.teamBScore - source.teamAScore} point win`
      : 'Match drawn';
  match.endedAt = now;
  match.timerState = {
    status: 'stopped',
    remainingMilliseconds: currentTimerRemaining(source.timerState, now),
    startedAt: null,
    pausedAt: now,
  };
  return { match, event: { type: 'MATCH_END', description: match.resultText, ...scoreChanges(source, match) } };
};

export const reopenMatch = ({ match: source, previousState }) => {
  requireMatch(source);
  if (source.status !== 'completed') throw createHttpError(409, 'Only a completed match can be reopened');
  if (!previousState || previousState.currentHalf !== 'second') throw createHttpError(409, 'Completed match does not have a restorable second-half state');
  const match = { ...clone(source), ...clone(previousState) };
  const remainingMilliseconds = currentTimerRemaining(previousState.timerState);
  match.status = 'live';
  match.currentHalf = 'second';
  match.winner = null;
  match.resultText = '';
  match.endedAt = null;
  match.timerState = { status: 'paused', remainingMilliseconds, startedAt: null, pausedAt: new Date() };
  return { match, event: { type: 'MATCH_REOPEN', description: 'Match reopened by super admin', ...scoreChanges(source, match) } };
};

export const matchLifecycleEngine = { currentTimerRemaining, runTimer, pauseTimer, endFirstHalf, startSecondHalf, endMatch, reopenMatch };
