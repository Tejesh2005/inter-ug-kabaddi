import { publicService } from '../services/publicService.js';

const send = (response, data) => response.json({ success: true, data });
const action = (handler) => async (request, response, next) => {
  try { await handler(request, response); } catch (error) { next(error); }
};

export const createPublicController = (service = publicService) => ({
  home: action(async (_request, response) => send(response, await service.home())),
  matches: action(async (request, response) => send(response, { matches: await service.matches(request.query) })),
  match: action(async (request, response) => send(response, { match: await service.match(request.params.id) })),
  events: action(async (request, response) => send(response, { events: await service.events(request.params.id) })),
  standings: action(async (request, response) => send(response, await service.standings(request.params.id))),
  team: action(async (request, response) => send(response, await service.team(request.params.id))),
  player: action(async (request, response) => send(response, { player: await service.player(request.params.id) })),
  leaderboards: action(async (request, response) => send(response, await service.leaderboards(request.params.id))),
});
