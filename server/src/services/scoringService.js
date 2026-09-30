import mongoose from 'mongoose';
import Match from '../models/Match.js';
import MatchEvent from '../models/MatchEvent.js';
import MatchLineup from '../models/MatchLineup.js';
import Player from '../models/Player.js';
import Tournament from '../models/Tournament.js';
import { createHttpError } from '../utils/httpError.js';
import { requireDatabaseConnection } from './databaseGuard.js';
import { applyRaid, applySubstitution, applyTackle, applyTechnicalPoint, startMatch } from './scoringEngine.js';

const eventDefaults = {
  raidingTeam: null,
  defendingTeam: null,
  raiderId: null,
  tacklerId: null,
  assistPlayers: [],
  touchedPlayers: [],
  playerOutIds: [],
  playerRevivedIds: [],
  bonusPoint: 0,
  raidPoints: 0,
  tacklePoints: 0,
  technicalPoints: 0,
  allOutPoints: 0,
};

const matchStateFields = [
  'status', 'currentHalf', 'currentRaidingTeam', 'currentRaider', 'raidNumber',
  'teamAScore', 'teamBScore', 'teamAPlayersOnCourt', 'teamBPlayersOnCourt',
  'teamAOutPlayers', 'teamBOutPlayers', 'teamARevivalQueue', 'teamBRevivalQueue',
  'teamASubstitutedOutPlayers', 'teamBSubstitutedOutPlayers',
  'timerState', 'startedAt',
];

const snapshot = (match) => Object.fromEntries(matchStateFields.map((field) => [field, match[field]]));

const loadContext = async (matchId, session) => {
  const match = await Match.findById(matchId).session(session).lean();
  if (!match) throw createHttpError(404, 'Match not found');
  const [tournament, lineups] = await Promise.all([
    Tournament.findById(match.tournamentId).session(session).lean(),
    MatchLineup.find({ matchId }).session(session).lean(),
  ]);
  if (!tournament) throw createHttpError(404, 'Tournament not found');
  return { match, tournament, lineups };
};

const getDuplicate = async (actionId, matchId, session) => {
  if (!actionId) throw createHttpError(400, 'actionId is required');
  const event = await MatchEvent.findOne({ actionId: actionId.toLowerCase() }).session(session).lean();
  if (!event) return null;
  if (event.matchId.toString() !== matchId.toString()) throw createHttpError(409, 'actionId has already been used');
  const match = await Match.findById(matchId).session(session).lean();
  return { match, event, duplicate: true };
};

const consecutiveEmptyRaids = async (matchId, raidingTeam, session) => {
  const events = await MatchEvent.find({ matchId, raidingTeam, isUndone: false, type: { $in: ['EMPTY_RAID', 'RAID_TOUCH', 'RAID_BONUS', 'TACKLE', 'SUPER_TACKLE', 'ALL_OUT'] } })
    .sort({ eventNumber: -1 }).limit(2).session(session).lean();
  return events.findIndex((event) => event.type !== 'EMPTY_RAID') === -1 ? events.length : events.findIndex((event) => event.type !== 'EMPTY_RAID');
};

const persistResult = async ({ context, result, actionId, adminId, session }) => {
  const previousState = snapshot(context.match);
  const eventNumber = await MatchEvent.countDocuments({ matchId: context.match._id }).session(session) + 1;
  const matchUpdate = Object.fromEntries(matchStateFields.filter((field) => field in result.match).map((field) => [field, result.match[field]]));
  await Match.updateOne({ _id: context.match._id }, { $set: matchUpdate }, { session, runValidators: true });
  for (const update of result.playerUpdates) {
    const increments = Object.fromEntries(Object.entries(update.changes).filter(([, value]) => value !== 0));
    if (Object.keys(increments).length) await Player.updateOne({ _id: update.playerId }, { $inc: increments }, { session });
  }
  const [event] = await MatchEvent.create([{
    ...eventDefaults,
    ...result.event,
    matchId: context.match._id,
    actionId: actionId.toLowerCase(),
    eventNumber,
    raidNumber: context.match.raidNumber,
    half: context.match.currentHalf === 'not_started' ? 'none' : context.match.currentHalf,
    createdBy: adminId,
    previousState,
    playerStatChanges: result.playerUpdates,
  }], { session });
  return { match: { ...context.match, ...matchUpdate }, event: event.toObject(), duplicate: false };
};

const execute = async (matchId, payload, adminId, calculate) => {
  requireDatabaseConnection();
  if (!mongoose.Types.ObjectId.isValid(adminId)) throw createHttpError(401, 'Invalid authenticated administrator');
  return mongoose.connection.transaction(async (session) => {
    const duplicate = await getDuplicate(payload.actionId, matchId, session);
    if (duplicate) return duplicate;
    const context = await loadContext(matchId, session);
    const result = await calculate(context, session);
    return persistResult({ context, result, actionId: payload.actionId, adminId, session });
  });
};

export const scoringService = {
  start: (matchId, payload, adminId) => execute(matchId, payload, adminId, async (context) => startMatch({
    match: context.match, lineups: context.lineups, settings: context.tournament.settings,
  })),
  raid: (matchId, payload, adminId) => execute(matchId, payload, adminId, async (context, session) => applyRaid({
    match: context.match,
    settings: context.tournament.settings,
    lineups: context.lineups,
    payload,
    consecutiveEmptyRaids: await consecutiveEmptyRaids(matchId, context.match.currentRaidingTeam, session),
  })),
  tackle: (matchId, payload, adminId) => execute(matchId, payload, adminId, async (context) => applyTackle({
    match: context.match, settings: context.tournament.settings, lineups: context.lineups, payload,
  })),
  technicalPoint: (matchId, payload, adminId) => execute(matchId, payload, adminId, async (context) => applyTechnicalPoint({
    match: context.match, payload,
  })),
  substitute: (matchId, payload, adminId) => execute(matchId, payload, adminId, async (context) => applySubstitution({
    match: context.match, lineups: context.lineups, payload,
  })),
};
