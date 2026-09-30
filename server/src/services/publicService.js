import Match from '../models/Match.js';
import MatchEvent from '../models/MatchEvent.js';
import MatchLineup from '../models/MatchLineup.js';
import Team from '../models/Team.js';
import Tournament from '../models/Tournament.js';
import Player from '../models/Player.js';
import { createHttpError } from '../utils/httpError.js';
import { requireDatabaseConnection } from './databaseGuard.js';

const statusFilters = {
  all: {},
  live: { status: { $in: ['live', 'halftime'] } },
  upcoming: { status: { $in: ['scheduled', 'upcoming'] } },
  completed: { status: 'completed' },
};

const publicMatch = (query) => query
  .populate('teamA', 'name shortName logo primaryColor secondaryColor')
  .populate('teamB', 'name shortName logo primaryColor secondaryColor')
  .populate('tournamentId', 'name shortName venue settings')
  .populate('currentRaider', 'name jerseyNumber role teamId')
  .populate('teamAPlayersOnCourt', 'name jerseyNumber role teamId')
  .populate('teamBPlayersOnCourt', 'name jerseyNumber role teamId')
  .populate('teamAOutPlayers', 'name jerseyNumber role teamId')
  .populate('teamBOutPlayers', 'name jerseyNumber role teamId');

const asId = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? String(value);
const zero = (team) => ({ team, matchesPlayed: 0, wins: 0, losses: 0, draws: 0, pointsFor: 0, pointsAgainst: 0, scoreDifference: 0, leaguePoints: 0, form: [] });
const blankMatchStats = (player) => ({
  _id: player._id,
  name: player.name,
  jerseyNumber: player.jerseyNumber,
  teamId: asId(player.teamId),
  totalPoints: 0,
  raidPoints: 0,
  bonusPoints: 0,
  totalRaids: 0,
  successfulRaids: 0,
  tacklePoints: 0,
  tacklesAttempted: 0,
  successfulTackles: 0,
});

const matchPlayerStats = async (matchId) => {
  const [lineups, events] = await Promise.all([
    MatchLineup.find({ matchId }).lean(),
    MatchEvent.find({ matchId, isUndone: false }).select('playerStatChanges').lean(),
  ]);
  const playerIds = [...new Set(lineups.flatMap((lineup) => [...lineup.startingSeven, ...lineup.substitutes]).map(asId))];
  if (!playerIds.length) return [];
  const players = await Player.find({ _id: { $in: playerIds } }).select('name jerseyNumber teamId').lean();
  const stats = new Map(players.map((player) => [asId(player), blankMatchStats(player)]));
  for (const event of events) {
    for (const change of event.playerStatChanges ?? []) {
      const player = stats.get(asId(change.playerId));
      if (!player) continue;
      const changes = change.changes ?? {};
      player.totalPoints += Number(changes.totalPoints) || 0;
      player.raidPoints += Number(changes['raidStats.raidPoints']) || 0;
      player.bonusPoints += Number(changes['raidStats.bonusPoints']) || 0;
      player.totalRaids += Number(changes['raidStats.totalRaids']) || 0;
      player.successfulRaids += Number(changes['raidStats.successfulRaids']) || 0;
      player.tacklePoints += Number(changes['defenceStats.tacklePoints']) || 0;
      player.tacklesAttempted += Number(changes['defenceStats.tacklesAttempted']) || 0;
      player.successfulTackles += Number(changes['defenceStats.successfulTackles']) || 0;
    }
  }
  return [...stats.values()].sort((a, b) => b.totalPoints - a.totalPoints || a.jerseyNumber - b.jerseyNumber);
};

export const calculateStandings = ({ teams, matches, pointsSystem, standingsRules }) => {
  const rows = new Map(teams.map((team) => [asId(team), zero(team)]));
  const ensureRow = (teamId) => {
    const key = asId(teamId);
    if (!rows.has(key)) rows.set(key, zero({ _id: key, name: 'Unknown team', shortName: 'TBD' }));
    return rows.get(key);
  };
  for (const match of matches.filter(({ status }) => status === 'completed')) {
    const a = ensureRow(match.teamA);
    const b = ensureRow(match.teamB);
    const aScore = Number(match.teamAScore) || 0;
    const bScore = Number(match.teamBScore) || 0;
    const draw = aScore === bScore;
    const aWin = aScore > bScore;
    const margin = Math.abs(aScore - bScore);
    const awarded = (won) => draw ? pointsSystem.drawPoints : won ? pointsSystem.winPoints : pointsSystem.closeLossEnabled && margin <= pointsSystem.closeLossMargin ? pointsSystem.closeLossPoints : pointsSystem.lossPoints;
    for (const [row, scored, conceded, won] of [[a, aScore, bScore, aWin], [b, bScore, aScore, !aWin]]) {
      row.matchesPlayed += 1;
      row.pointsFor += scored;
      row.pointsAgainst += conceded;
      row.scoreDifference += scored - conceded;
      row.leaguePoints += awarded(won);
      if (draw) { row.draws += 1; row.form.push('D'); } else if (won) { row.wins += 1; row.form.push('W'); } else { row.losses += 1; row.form.push('L'); }
    }
  }
  const keys = [standingsRules.primary, standingsRules.secondary, standingsRules.tertiary];
  return [...rows.values()]
    .map((row) => ({ ...row, form: row.form.slice(-5) }))
    .sort((a, b) => keys.map((key) => b[key] - a[key]).find((value) => value !== 0) ?? a.team.name.localeCompare(b.team.name))
    .map((row, index) => ({ ...row, position: index + 1 }));
};

export const publicService = {
  home: async () => {
    requireDatabaseConnection();
    const tournament = await Tournament.findOne({ status: { $in: ['live', 'upcoming'] } }).sort({ startDate: 1 }).lean() ?? await Tournament.findOne().sort({ startDate: -1 }).lean();
    const scope = tournament ? { tournamentId: tournament._id } : {};
    const [liveMatches, upcomingMatches, recentResults] = await Promise.all([
      publicMatch(Match.find({ ...scope, ...statusFilters.live }).sort({ scheduledDate: 1, scheduledTime: 1 }).limit(1)).lean(),
      publicMatch(Match.find({ ...scope, ...statusFilters.upcoming }).sort({ scheduledDate: 1, scheduledTime: 1 }).limit(4)).lean(),
      publicMatch(Match.find({ ...scope, ...statusFilters.completed }).sort({ endedAt: -1, scheduledDate: -1 }).limit(4)).lean(),
    ]);
    return { tournament, liveMatch: liveMatches[0] ?? null, upcomingMatches, recentResults };
  },
  matches: async ({ filter = 'all', tournamentId } = {}) => {
    requireDatabaseConnection();
    if (!statusFilters[filter]) throw createHttpError(400, 'Invalid match filter');
    return publicMatch(Match.find({ ...statusFilters[filter], ...(tournamentId ? { tournamentId } : {}) }).sort({ scheduledDate: filter === 'completed' ? -1 : 1, scheduledTime: 1 })).lean();
  },
  match: async (matchId) => {
    requireDatabaseConnection();
    const [match, playerStats] = await Promise.all([publicMatch(Match.findById(matchId)).lean(), matchPlayerStats(matchId)]);
    if (!match) throw createHttpError(404, 'Match not found');
    return { ...match, playerStats };
  },
  events: async (matchId) => {
    requireDatabaseConnection();
    return MatchEvent.find({ matchId, isUndone: false }).sort({ eventNumber: -1 }).limit(12)
      .populate('raiderId', 'name jerseyNumber').populate('tacklerId', 'name jerseyNumber').lean();
  },
  standings: async (tournamentId) => {
    requireDatabaseConnection();
    const tournament = await Tournament.findById(tournamentId).lean();
    if (!tournament) throw createHttpError(404, 'Tournament not found');
    const [teams, matches] = await Promise.all([
      Team.find({ status: 'active' }).sort({ name: 1 }).lean(),
      Match.find({ tournamentId, status: 'completed' }).select('teamA teamB teamAScore teamBScore status').lean(),
    ]);
    return { tournament, standings: calculateStandings({ teams, matches, pointsSystem: tournament.pointsSystem, standingsRules: tournament.standingsRules }) };
  },
  team: async (teamId) => {
    requireDatabaseConnection();
    const team = await Team.findById(teamId).populate({ path: 'players', select: 'name jerseyNumber photo role optionalPosition isCaptain isViceCaptain matchesPlayed raidStats defenceStats totalPoints', options: { sort: { jerseyNumber: 1 } } }).lean();
    if (!team) throw createHttpError(404, 'Team not found');
    const [recentMatches, upcomingMatches] = await Promise.all([
      publicMatch(Match.find({ $or: [{ teamA: teamId }, { teamB: teamId }], status: 'completed' }).sort({ endedAt: -1 }).limit(5)).lean(),
      publicMatch(Match.find({ $or: [{ teamA: teamId }, { teamB: teamId }], status: { $in: ['scheduled', 'upcoming'] } }).sort({ scheduledDate: 1, scheduledTime: 1 }).limit(5)).lean(),
    ]);
    return { team, recentMatches, upcomingMatches };
  },
  player: async (playerId) => {
    requireDatabaseConnection();
    const player = await Player.findById(playerId).populate('teamId', 'name shortName logo primaryColor secondaryColor').lean();
    if (!player) throw createHttpError(404, 'Player not found');
    return player;
  },
  leaderboards: async (tournamentId) => {
    requireDatabaseConnection();
    const tournament = await Tournament.findById(tournamentId).lean();
    if (!tournament) throw createHttpError(404, 'Tournament not found');
    const matches = await Match.find({ tournamentId }).select('teamA teamB').lean();
    const teamIds = [...new Set(matches.flatMap((match) => [asId(match.teamA), asId(match.teamB)]))];
    const players = await Player.find(teamIds.length ? { teamId: { $in: teamIds } } : {}).populate('teamId', 'name shortName primaryColor').lean();
    const top = (path) => [...players].sort((a, b) => path.split('.').reduce((value, key) => value?.[key], b) - path.split('.').reduce((value, key) => value?.[key], a) || a.name.localeCompare(b.name)).slice(0, 10);
    return { tournament, leaderboards: { totalPoints: top('totalPoints'), raidPoints: top('raidStats.raidPoints'), tacklePoints: top('defenceStats.tacklePoints'), bonusPoints: top('raidStats.bonusPoints'), successfulRaids: top('raidStats.successfulRaids'), superTackles: top('defenceStats.superTackles') } };
  },
};
