import mongoose from 'mongoose';
import Match from '../models/Match.js';
import MatchEvent from '../models/MatchEvent.js';
import MatchLineup from '../models/MatchLineup.js';
import Player from '../models/Player.js';
import Team from '../models/Team.js';
import Tournament from '../models/Tournament.js';
import { createHttpError } from '../utils/httpError.js';
import { requireDatabaseConnection } from './databaseGuard.js';
import { endFirstHalf, endMatch, pauseTimer, reopenMatch, runTimer, startSecondHalf } from './matchLifecycleEngine.js';

const stateFields = [
  'status', 'currentHalf', 'currentRaidingTeam', 'currentRaider', 'raidNumber',
  'teamAScore', 'teamBScore', 'firstHalfTeamAScore', 'firstHalfTeamBScore',
  'secondHalfTeamAScore', 'secondHalfTeamBScore', 'winner', 'resultText',
  'teamAPlayersOnCourt', 'teamBPlayersOnCourt', 'teamAOutPlayers', 'teamBOutPlayers',
  'teamARevivalQueue', 'teamBRevivalQueue', 'timerState', 'startedAt', 'endedAt',
];

const eventDefaults = {
  raidingTeam: null, defendingTeam: null, raiderId: null, tacklerId: null,
  assistPlayers: [], touchedPlayers: [], playerOutIds: [], playerRevivedIds: [],
  bonusPoint: 0, raidPoints: 0, tacklePoints: 0, technicalPoints: 0, allOutPoints: 0,
};

const snapshot = (match) => Object.fromEntries(stateFields.map((field) => [field, match[field]]));
const updateFrom = (match) => Object.fromEntries(stateFields.filter((field) => field in match).map((field) => [field, match[field]]));
const unique = (values) => [...new Set(values.map((value) => value.toString()))];

const validateAction = (payload, adminId) => {
  if (!payload.actionId) throw createHttpError(400, 'actionId is required');
  if (!mongoose.Types.ObjectId.isValid(adminId)) throw createHttpError(401, 'Invalid authenticated administrator');
};

const duplicateResult = async (actionId, matchId, session) => {
  const event = await MatchEvent.findOne({ actionId: actionId.toLowerCase() }).session(session).lean();
  if (!event) return null;
  if (event.matchId.toString() !== matchId.toString()) throw createHttpError(409, 'actionId has already been used');
  return { match: await Match.findById(matchId).session(session).lean(), event, duplicate: true };
};

const createEvent = async ({ source, result, actionId, adminId, session }) => {
  const eventNumber = await MatchEvent.countDocuments({ matchId: source._id }).session(session) + 1;
  const previousState = snapshot(source);
  if (result.event.type === 'MATCH_END') {
    previousState.timerState = { ...result.match.timerState, status: 'paused' };
  }
  const [event] = await MatchEvent.create([{
    ...eventDefaults,
    ...result.event,
    matchId: source._id,
    actionId: actionId.toLowerCase(),
    eventNumber,
    raidNumber: source.raidNumber,
    half: ['first', 'halftime', 'second'].includes(source.currentHalf) ? source.currentHalf : 'none',
    createdBy: adminId,
    previousState,
  }], { session });
  return event.toObject();
};

const teamStatChanges = (match, pointsSystem, direction = 1) => {
  const draw = match.teamAScore === match.teamBScore;
  const aWon = match.teamAScore > match.teamBScore;
  const margin = Math.abs(match.teamAScore - match.teamBScore);
  const points = (won) => {
    if (draw) return pointsSystem.drawPoints;
    if (won) return pointsSystem.winPoints;
    return pointsSystem.closeLossEnabled && margin <= pointsSystem.closeLossMargin ? pointsSystem.closeLossPoints : pointsSystem.lossPoints;
  };
  return [
    [match.teamA, { matchesPlayed: 1, wins: aWon ? 1 : 0, losses: !draw && !aWon ? 1 : 0, draws: draw ? 1 : 0, pointsFor: match.teamAScore, pointsAgainst: match.teamBScore, scoreDifference: match.teamAScore - match.teamBScore, leaguePoints: points(aWon) }],
    [match.teamB, { matchesPlayed: 1, wins: !draw && !aWon ? 1 : 0, losses: aWon ? 1 : 0, draws: draw ? 1 : 0, pointsFor: match.teamBScore, pointsAgainst: match.teamAScore, scoreDifference: match.teamBScore - match.teamAScore, leaguePoints: points(!draw && !aWon) }],
  ].map(([teamId, changes]) => [teamId, Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value * direction]))]);
};

const updateCompletionStats = async ({ match, tournament, lineups, direction, session }) => {
  for (const [teamId, changes] of teamStatChanges(match, tournament.pointsSystem, direction)) {
    await Team.updateOne({ _id: teamId }, { $inc: changes }, { session });
  }
  const playerIds = unique(lineups.flatMap((lineup) => [...lineup.startingSeven, ...lineup.substitutes]));
  if (playerIds.length) await Player.updateMany({ _id: { $in: playerIds } }, { $inc: { matchesPlayed: direction } }, { session });
};

const execute = async (matchId, payload, adminId, calculate, { completionDirection = 0 } = {}) => {
  requireDatabaseConnection();
  validateAction(payload, adminId);
  return mongoose.connection.transaction(async (session) => {
    const duplicate = await duplicateResult(payload.actionId, matchId, session);
    if (duplicate) return duplicate;
    const source = await Match.findById(matchId).session(session).lean();
    if (!source) throw createHttpError(404, 'Match not found');
    const [tournament, lineups] = await Promise.all([
      Tournament.findById(source.tournamentId).session(session).lean(),
      MatchLineup.find({ matchId }).session(session).lean(),
    ]);
    if (!tournament) throw createHttpError(404, 'Tournament not found');
    const result = await calculate({ source, tournament, lineups, session });
    const matchUpdate = updateFrom(result.match);
    await Match.updateOne({ _id: matchId }, { $set: matchUpdate }, { session, runValidators: true });
    if (completionDirection) await updateCompletionStats({ match: completionDirection > 0 ? result.match : source, tournament, lineups, direction: completionDirection, session });
    const event = await createEvent({ source, result, actionId: payload.actionId, adminId, session });
    return { match: { ...source, ...matchUpdate }, event, duplicate: false };
  });
};

export const matchLifecycleService = {
  runTimer: (matchId, payload, adminId) => execute(matchId, payload, adminId, ({ source }) => runTimer({ match: source })),
  pauseTimer: (matchId, payload, adminId) => execute(matchId, payload, adminId, ({ source }) => pauseTimer({ match: source })),
  endFirstHalf: (matchId, payload, adminId) => execute(matchId, payload, adminId, ({ source }) => endFirstHalf({ match: source })),
  startSecondHalf: (matchId, payload, adminId) => execute(matchId, payload, adminId, ({ source, tournament }) => startSecondHalf({ match: source, halfDuration: tournament.settings.halfDuration })),
  endMatch: (matchId, payload, adminId) => execute(matchId, payload, adminId, ({ source }) => endMatch({ match: source }), { completionDirection: 1 }),
  reopen: (matchId, payload, adminId) => execute(matchId, payload, adminId, async ({ source, session }) => {
    const endEvent = await MatchEvent.findOne({ matchId, type: 'MATCH_END' }).sort({ eventNumber: -1 }).session(session).lean();
    return reopenMatch({ match: source, previousState: endEvent?.previousState });
  }, { completionDirection: -1 }),
};
