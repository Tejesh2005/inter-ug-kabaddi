import mongoose from 'mongoose';
import Match from '../models/Match.js';
import MatchEvent from '../models/MatchEvent.js';
import Player from '../models/Player.js';
import { createHttpError } from '../utils/httpError.js';
import { requireDatabaseConnection } from './databaseGuard.js';
import { applyScoreCorrection, reverseMatchEvent } from './eventEngine.js';

const reversibleTypes = ['RAID_TOUCH', 'RAID_BONUS', 'EMPTY_RAID', 'TACKLE', 'SUPER_TACKLE', 'ALL_OUT', 'TECHNICAL_POINT', 'SCORE_CORRECTION'];
const stateFields = ['status', 'currentHalf', 'currentRaidingTeam', 'currentRaider', 'raidNumber', 'teamAScore', 'teamBScore', 'teamAPlayersOnCourt', 'teamBPlayersOnCourt', 'teamAOutPlayers', 'teamBOutPlayers', 'teamARevivalQueue', 'teamBRevivalQueue', 'timerState', 'startedAt'];
const snapshot = (match) => Object.fromEntries(stateFields.map((field) => [field, match[field]]));
const defaults = { raidingTeam: null, defendingTeam: null, raiderId: null, tacklerId: null, assistPlayers: [], touchedPlayers: [], playerOutIds: [], playerRevivedIds: [], bonusPoint: 0, raidPoints: 0, tacklePoints: 0, technicalPoints: 0, allOutPoints: 0 };

const validateAction = (actionId, adminId) => {
  if (!actionId) throw createHttpError(400, 'actionId is required');
  if (!mongoose.Types.ObjectId.isValid(adminId)) throw createHttpError(401, 'Invalid authenticated administrator');
};

const duplicateResult = async (actionId, matchId, session) => {
  const event = await MatchEvent.findOne({ actionId: actionId.toLowerCase() }).session(session).lean();
  if (!event) return null;
  if (event.matchId.toString() !== matchId.toString()) throw createHttpError(409, 'actionId has already been used');
  return { match: await Match.findById(matchId).session(session).lean(), event, duplicate: true };
};

const createEvent = async ({ match, actionId, adminId, data, previousState, playerStatChanges = [], session }) => {
  const eventNumber = await MatchEvent.countDocuments({ matchId: match._id }).session(session) + 1;
  const [event] = await MatchEvent.create([{ ...defaults, ...data, matchId: match._id, actionId: actionId.toLowerCase(), eventNumber, raidNumber: match.raidNumber, half: ['first', 'second', 'halftime'].includes(match.currentHalf) ? match.currentHalf : 'none', createdBy: adminId, previousState, playerStatChanges }], { session });
  return event.toObject();
};

export const auditService = {
  latest: async (matchId) => {
    requireDatabaseConnection();
    return MatchEvent.findOne({ matchId, isUndone: false, type: { $in: reversibleTypes } }).sort({ eventNumber: -1 }).lean();
  },

  list: async (matchId, { limit = 50 } = {}) => {
    requireDatabaseConnection();
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    return MatchEvent.find({ matchId }).sort({ eventNumber: -1 }).limit(safeLimit)
      .populate('createdBy', 'name email role').populate('undoneBy', 'name email role').lean();
  },

  correction: async (matchId, payload, adminId) => {
    requireDatabaseConnection(); validateAction(payload.actionId, adminId);
    return mongoose.connection.transaction(async (session) => {
      const duplicate = await duplicateResult(payload.actionId, matchId, session);
      if (duplicate) return duplicate;
      const match = await Match.findById(matchId).session(session).lean();
      const result = applyScoreCorrection({ match, payload });
      await Match.updateOne({ _id: matchId }, { $set: { teamAScore: result.match.teamAScore, teamBScore: result.match.teamBScore } }, { session, runValidators: true });
      const event = await createEvent({ match, actionId: payload.actionId, adminId, data: result.event, previousState: snapshot(match), session });
      return { match: { ...match, teamAScore: result.match.teamAScore, teamBScore: result.match.teamBScore }, event, duplicate: false };
    });
  },

  undo: async (matchId, payload, adminId) => {
    requireDatabaseConnection(); validateAction(payload.actionId, adminId);
    return mongoose.connection.transaction(async (session) => {
      const duplicate = await duplicateResult(payload.actionId, matchId, session);
      if (duplicate) return duplicate;
      const match = await Match.findById(matchId).session(session).lean();
      if (!match) throw createHttpError(404, 'Match not found');
      const latest = await MatchEvent.findOne({ matchId, isUndone: false, type: { $in: reversibleTypes } }).sort({ eventNumber: -1 }).session(session).lean();
      if (!latest) throw createHttpError(409, 'There is no scoring action to undo');
      if (payload.eventId && latest._id.toString() !== payload.eventId.toString()) throw createHttpError(409, 'Only the latest scoring action can be undone');
      const reversed = reverseMatchEvent({ match, event: latest });
      const restoredState = Object.fromEntries(stateFields.filter((field) => field in reversed.match).map((field) => [field, reversed.match[field]]));
      await Match.updateOne({ _id: matchId }, { $set: restoredState }, { session, runValidators: true });
      for (const update of reversed.playerUpdates) await Player.updateOne({ _id: update.playerId }, { $inc: update.changes }, { session });
      await MatchEvent.updateOne({ _id: latest._id }, { $set: { isUndone: true, undoneAt: new Date(), undoneBy: adminId } }, { session });
      const event = await createEvent({ match, actionId: payload.actionId, adminId, previousState: snapshot(match), session, data: { type: 'UNDO', undoneEventId: latest._id, description: `Undo: ${latest.description}`, teamAPointsChange: restoredState.teamAScore - match.teamAScore, teamBPointsChange: restoredState.teamBScore - match.teamBScore, teamAScoreAfter: restoredState.teamAScore, teamBScoreAfter: restoredState.teamBScore } });
      return { match: { ...match, ...restoredState }, event, undoneEvent: { ...latest, isUndone: true }, duplicate: false };
    });
  },
};
