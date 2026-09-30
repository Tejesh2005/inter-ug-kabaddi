import Tournament from '../models/Tournament.js';
import { createHttpError } from '../utils/httpError.js';
import { pick } from '../utils/pick.js';
import { requireDatabaseConnection } from './databaseGuard.js';

const fields = [
  'name', 'shortName', 'logo', 'venue', 'startDate', 'endDate', 'status', 'format',
  'settings', 'pointsSystem', 'standingsRules',
];

export const tournamentService = {
  list: async () => {
    requireDatabaseConnection();
    return Tournament.find().sort({ startDate: -1 }).lean();
  },
  getById: async (id) => {
    requireDatabaseConnection();
    const tournament = await Tournament.findById(id).lean();
    if (!tournament) throw createHttpError(404, 'Tournament not found');
    return tournament;
  },
  create: async (payload) => {
    requireDatabaseConnection();
    return Tournament.create(pick(payload, fields));
  },
  update: async (id, payload) => {
    requireDatabaseConnection();
    const tournament = await Tournament.findByIdAndUpdate(id, pick(payload, fields), {
      new: true, runValidators: true,
    });
    if (!tournament) throw createHttpError(404, 'Tournament not found');
    return tournament;
  },
};
