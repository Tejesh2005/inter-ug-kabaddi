import { createHttpError } from '../utils/httpError.js';

const id = (value) => value?.toString();

export const applyScoreCorrection = ({ match: source, payload }) => {
  if (!source) throw createHttpError(404, 'Match not found');
  if (!['live', 'halftime'].includes(source.status)) throw createHttpError(409, 'Corrections are available only for an active match');
  if (!payload.reason?.trim()) throw createHttpError(400, 'Correction reason is required');
  if (!Number.isInteger(payload.adjustment) || payload.adjustment === 0 || Math.abs(payload.adjustment) > 20) {
    throw createHttpError(400, 'Correction must be a non-zero integer between -20 and 20');
  }
  const side = id(source.teamA) === id(payload.teamId) ? 'A' : id(source.teamB) === id(payload.teamId) ? 'B' : null;
  if (!side) throw createHttpError(400, 'Correction team is not part of this match');
  const scoreField = `team${side}Score`;
  const nextScore = source[scoreField] + payload.adjustment;
  if (nextScore < 0) throw createHttpError(400, 'Correction cannot make a score negative');
  const match = { ...source, [scoreField]: nextScore };
  return {
    match,
    event: {
      type: 'SCORE_CORRECTION',
      description: `Score correction: ${payload.reason.trim()}`,
      teamAPointsChange: side === 'A' ? payload.adjustment : 0,
      teamBPointsChange: side === 'B' ? payload.adjustment : 0,
      teamAScoreAfter: match.teamAScore,
      teamBScoreAfter: match.teamBScore,
    },
  };
};

export const reverseMatchEvent = ({ match, event }) => {
  if (!event?.previousState) throw createHttpError(409, 'This event does not contain a reversible state');
  const restoredMatch = { ...match, ...event.previousState };
  const inversePlayerUpdates = (event.playerStatChanges ?? []).map((update) => ({
    playerId: update.playerId,
    changes: Object.fromEntries(Object.entries(update.changes ?? {}).map(([field, value]) => [field, -value])),
  }));
  return { match: restoredMatch, playerUpdates: inversePlayerUpdates };
};

export const eventEngine = { applyScoreCorrection, reverseMatchEvent };
