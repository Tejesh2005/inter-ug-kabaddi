import Match from '../models/Match.js';
import Team from '../models/Team.js';
import Tournament from '../models/Tournament.js';
import { createHttpError } from '../utils/httpError.js';
import { pick } from '../utils/pick.js';
import { requireDatabaseConnection } from './databaseGuard.js';

const editableFields = [
  'tournamentId', 'matchNumber', 'teamA', 'teamB', 'stage', 'scheduledDate', 'scheduledTime', 'venue',
];

const statusFilters = {
  all: {},
  live: { status: { $in: ['live', 'halftime'] } },
  upcoming: { status: { $in: ['scheduled', 'upcoming'] } },
  completed: { status: 'completed' },
};

const dayValue = (value) => {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

export const validateFixtureDetails = ({ tournament, teamAExists, teamBExists, payload }) => {
  if (!tournament) throw createHttpError(404, 'Tournament not found');
  if (!teamAExists || !teamBExists) throw createHttpError(404, 'One or both teams were not found');
  if (payload.teamA?.toString() === payload.teamB?.toString()) throw createHttpError(400, 'A team cannot play itself');

  const fixtureDay = dayValue(payload.scheduledDate);
  if (Number.isNaN(fixtureDay)) throw createHttpError(400, 'A valid fixture date is required');
  if (fixtureDay < dayValue(tournament.startDate) || fixtureDay > dayValue(tournament.endDate)) {
    throw createHttpError(400, 'Fixture date must fall within the tournament schedule');
  }
};

const validateReferences = async (payload) => {
  const [tournament, teamAExists, teamBExists] = await Promise.all([
    Tournament.findById(payload.tournamentId).lean(),
    Team.exists({ _id: payload.teamA, status: 'active' }),
    Team.exists({ _id: payload.teamB, status: 'active' }),
  ]);
  validateFixtureDetails({ tournament, teamAExists, teamBExists, payload });
};

const populateFixture = (query) => query
  .populate('teamA', 'name shortName logo primaryColor secondaryColor')
  .populate('teamB', 'name shortName logo primaryColor secondaryColor')
  .populate('tournamentId', 'name shortName settings');

export const matchService = {
  list: async ({ filter = 'all', tournamentId } = {}) => {
    requireDatabaseConnection();
    if (!statusFilters[filter]) throw createHttpError(400, 'Invalid match filter');
    const query = { ...statusFilters[filter], ...(tournamentId ? { tournamentId } : {}) };
    const sort = filter === 'completed' ? { scheduledDate: -1, scheduledTime: -1 } : { scheduledDate: 1, scheduledTime: 1 };
    return populateFixture(Match.find(query).sort(sort)).lean();
  },
  getById: async (id) => {
    requireDatabaseConnection();
    const match = await populateFixture(Match.findById(id)).lean();
    if (!match) throw createHttpError(404, 'Match not found');
    return match;
  },
  create: async (payload) => {
    requireDatabaseConnection();
    const data = pick(payload, editableFields);
    await validateReferences(data);
    return Match.create(data);
  },
  update: async (id, payload) => {
    requireDatabaseConnection();
    const match = await Match.findById(id);
    if (!match) throw createHttpError(404, 'Match not found');
    if (!['scheduled', 'upcoming'].includes(match.status)) {
      throw createHttpError(409, 'A match cannot be edited after it has started');
    }

    Object.assign(match, pick(payload, editableFields));
    await validateReferences(match.toObject());
    await match.save();
    return match;
  },
};
