import Team from '../models/Team.js';
import Player from '../models/Player.js';
import { createHttpError } from '../utils/httpError.js';
import { pick } from '../utils/pick.js';
import { requireDatabaseConnection } from './databaseGuard.js';

const fields = ['name', 'shortName', 'departmentOrUG', 'logo', 'primaryColor', 'secondaryColor', 'status'];

export const teamService = {
  list: async () => {
    requireDatabaseConnection();
    return Team.find().sort({ name: 1 }).lean();
  },
  getById: async (id) => {
    requireDatabaseConnection();
    const team = await Team.findById(id).populate({ path: 'players', options: { sort: { jerseyNumber: 1 } } }).lean();
    if (!team) throw createHttpError(404, 'Team not found');
    return team;
  },
  create: async (payload) => {
    requireDatabaseConnection();
    return Team.create(pick(payload, fields));
  },
  update: async (id, payload) => {
    requireDatabaseConnection();
    const team = await Team.findByIdAndUpdate(id, pick(payload, fields), { new: true, runValidators: true });
    if (!team) throw createHttpError(404, 'Team not found');
    return team;
  },
  remove: async (id) => {
    requireDatabaseConnection();
    if (await Player.exists({ teamId: id })) throw createHttpError(409, 'Remove the team players before deleting this team');
    const team = await Team.findByIdAndDelete(id);
    if (!team) throw createHttpError(404, 'Team not found');
    return team;
  },
};
