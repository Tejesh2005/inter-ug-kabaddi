import Player from '../models/Player.js';
import Team from '../models/Team.js';
import { createHttpError } from '../utils/httpError.js';
import { pick } from '../utils/pick.js';
import { requireDatabaseConnection } from './databaseGuard.js';

const fields = ['name', 'jerseyNumber', 'photo', 'teamId', 'role', 'optionalPosition', 'isCaptain', 'isViceCaptain'];

const ensureTeam = async (teamId) => {
  if (!await Team.exists({ _id: teamId })) throw createHttpError(404, 'Team not found');
};

const applyLeadership = async (player) => {
  if (player.isCaptain) {
    await Player.updateMany({ teamId: player.teamId, _id: { $ne: player._id } }, { $set: { isCaptain: false } });
    await Team.findByIdAndUpdate(player.teamId, { $set: { captain: player._id } });
  }
  if (player.isViceCaptain) {
    await Player.updateMany({ teamId: player.teamId, _id: { $ne: player._id } }, { $set: { isViceCaptain: false } });
  }
};

export const playerService = {
  list: async ({ teamId } = {}) => {
    requireDatabaseConnection();
    const query = teamId ? { teamId } : {};
    return Player.find(query).sort({ teamId: 1, jerseyNumber: 1 }).lean();
  },
  getById: async (id) => {
    requireDatabaseConnection();
    const player = await Player.findById(id).lean();
    if (!player) throw createHttpError(404, 'Player not found');
    return player;
  },
  create: async (payload) => {
    requireDatabaseConnection();
    const data = pick(payload, fields);
    await ensureTeam(data.teamId);
    const player = await Player.create(data);
    await Team.findByIdAndUpdate(player.teamId, { $addToSet: { players: player._id } });
    await applyLeadership(player);
    return player;
  },
  update: async (id, payload) => {
    requireDatabaseConnection();
    const player = await Player.findById(id);
    if (!player) throw createHttpError(404, 'Player not found');

    const previousTeamId = player.teamId;
    const wasCaptain = player.isCaptain;
    Object.assign(player, pick(payload, fields));
    await ensureTeam(player.teamId);
    await player.save();

    if (!previousTeamId.equals(player.teamId)) {
      await Team.findByIdAndUpdate(previousTeamId, { $pull: { players: player._id }, $unset: wasCaptain ? { captain: 1 } : {} });
      await Team.findByIdAndUpdate(player.teamId, { $addToSet: { players: player._id } });
    } else if (wasCaptain && !player.isCaptain) {
      await Team.updateOne({ _id: player.teamId, captain: player._id }, { $unset: { captain: 1 } });
    }

    await applyLeadership(player);
    return player;
  },
  remove: async (id) => {
    requireDatabaseConnection();
    const player = await Player.findByIdAndDelete(id);
    if (!player) throw createHttpError(404, 'Player not found');
    await Team.findByIdAndUpdate(player.teamId, { $pull: { players: player._id } });
    await Team.updateOne({ _id: player.teamId, captain: player._id }, { $unset: { captain: 1 } });
    return player;
  },
};
