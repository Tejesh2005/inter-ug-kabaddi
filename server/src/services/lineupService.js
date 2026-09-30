import Match from '../models/Match.js';
import MatchLineup from '../models/MatchLineup.js';
import Player from '../models/Player.js';
import Tournament from '../models/Tournament.js';
import { createHttpError } from '../utils/httpError.js';
import { requireDatabaseConnection } from './databaseGuard.js';

const strings = (values = []) => values.map((value) => value.toString());

export const validateTeamLineup = ({ lineup, registeredPlayerIds, settings, teamLabel }) => {
  const starters = strings(lineup?.startingSeven);
  const substitutes = strings(lineup?.substitutes);
  const squad = [...starters, ...substitutes];
  const uniqueSquad = new Set(squad);

  if (starters.length !== settings.numberOfPlayersOnCourt) {
    throw createHttpError(400, `${teamLabel} must select exactly ${settings.numberOfPlayersOnCourt} starting players`);
  }
  if (squad.length > settings.maximumSquadSize) {
    throw createHttpError(400, `${teamLabel} squad cannot exceed ${settings.maximumSquadSize} players`);
  }
  if (uniqueSquad.size !== squad.length) throw createHttpError(400, `${teamLabel} lineup contains duplicate players`);

  const registered = new Set(strings(registeredPlayerIds));
  if (squad.some((playerId) => !registered.has(playerId))) {
    throw createHttpError(400, `${teamLabel} lineup contains a player outside its registered squad`);
  }
  if (!lineup?.captain || !uniqueSquad.has(lineup.captain.toString())) {
    throw createHttpError(400, `${teamLabel} captain must be selected in the match squad`);
  }
};

export const validateLineupSubmission = ({ match, tournament, teamALineup, teamBLineup, teamAPlayerIds, teamBPlayerIds, firstRaidingTeam }) => {
  if (!match) throw createHttpError(404, 'Match not found');
  if (!['scheduled', 'upcoming'].includes(match.status)) throw createHttpError(409, 'Lineups cannot be changed after the match has started');
  if (!tournament) throw createHttpError(404, 'Tournament not found');

  validateTeamLineup({ lineup: teamALineup, registeredPlayerIds: teamAPlayerIds, settings: tournament.settings, teamLabel: 'Team A' });
  validateTeamLineup({ lineup: teamBLineup, registeredPlayerIds: teamBPlayerIds, settings: tournament.settings, teamLabel: 'Team B' });

  const firstRaid = firstRaidingTeam?.toString();
  if (![match.teamA.toString(), match.teamB.toString()].includes(firstRaid)) {
    throw createHttpError(400, 'First raiding team must be one of the teams in the match');
  }
};

const populateLineup = (query) => query
  .populate('teamId', 'name shortName logo primaryColor secondaryColor')
  .populate('startingSeven', 'name jerseyNumber role optionalPosition photo isCaptain isViceCaptain')
  .populate('substitutes', 'name jerseyNumber role optionalPosition photo isCaptain isViceCaptain')
  .populate('captain', 'name jerseyNumber');

export const lineupService = {
  get: async (matchId) => {
    requireDatabaseConnection();
    const match = await Match.findById(matchId)
      .populate('teamA', 'name shortName logo primaryColor secondaryColor')
      .populate('teamB', 'name shortName logo primaryColor secondaryColor')
      .lean();
    if (!match) throw createHttpError(404, 'Match not found');
    const lineups = await populateLineup(MatchLineup.find({ matchId })).lean();
    return { match, lineups, firstRaidingTeam: match.currentRaidingTeam };
  },

  save: async (matchId, payload) => {
    requireDatabaseConnection();
    const match = await Match.findById(matchId).lean();
    if (!match) throw createHttpError(404, 'Match not found');

    const [tournament, teamAPlayers, teamBPlayers] = await Promise.all([
      Tournament.findById(match.tournamentId).lean(),
      Player.find({ teamId: match.teamA }).select('_id').lean(),
      Player.find({ teamId: match.teamB }).select('_id').lean(),
    ]);

    validateLineupSubmission({
      match,
      tournament,
      teamALineup: payload.teamA,
      teamBLineup: payload.teamB,
      teamAPlayerIds: teamAPlayers.map((player) => player._id),
      teamBPlayerIds: teamBPlayers.map((player) => player._id),
      firstRaidingTeam: payload.firstRaidingTeam,
    });

    await MatchLineup.bulkWrite([
      {
        updateOne: {
          filter: { matchId, teamId: match.teamA },
          update: { $set: { startingSeven: payload.teamA.startingSeven, substitutes: payload.teamA.substitutes, captain: payload.teamA.captain } },
          upsert: true,
        },
      },
      {
        updateOne: {
          filter: { matchId, teamId: match.teamB },
          update: { $set: { startingSeven: payload.teamB.startingSeven, substitutes: payload.teamB.substitutes, captain: payload.teamB.captain } },
          upsert: true,
        },
      },
    ]);
    await Match.findByIdAndUpdate(matchId, { $set: { currentRaidingTeam: payload.firstRaidingTeam } });

    return lineupService.get(matchId);
  },
};
