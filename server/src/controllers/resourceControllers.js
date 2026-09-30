import { playerService } from '../services/playerService.js';
import { teamService } from '../services/teamService.js';
import { tournamentService } from '../services/tournamentService.js';
import { matchService } from '../services/matchService.js';
import { lineupService } from '../services/lineupService.js';
import { scoringService } from '../services/scoringService.js';
import { auditService } from '../services/auditService.js';
import { matchLifecycleService } from '../services/matchLifecycleService.js';

const send = (response, data, status = 200) => response.status(status).json({ success: true, data });
const sendMatchAction = (request, response, data) => {
  request.app.get('realtime')?.broadcast(data);
  send(response, data);
};
const action = (handler) => async (request, response, next) => {
  try {
    await handler(request, response);
  } catch (error) {
    next(error);
  }
};

export const createTournamentController = (service = tournamentService) => ({
  list: action(async (_request, response) => send(response, { tournaments: await service.list() })),
  get: action(async (request, response) => send(response, { tournament: await service.getById(request.params.id) })),
  create: action(async (request, response) => send(response, { tournament: await service.create(request.body) }, 201)),
  update: action(async (request, response) => send(response, { tournament: await service.update(request.params.id, request.body) })),
});

export const createTeamController = (service = teamService) => ({
  list: action(async (_request, response) => send(response, { teams: await service.list() })),
  get: action(async (request, response) => send(response, { team: await service.getById(request.params.id) })),
  create: action(async (request, response) => send(response, { team: await service.create(request.body) }, 201)),
  update: action(async (request, response) => send(response, { team: await service.update(request.params.id, request.body) })),
  remove: action(async (request, response) => send(response, { team: await service.remove(request.params.id) })),
});

export const createPlayerController = (service = playerService) => ({
  list: action(async (request, response) => send(response, { players: await service.list({ teamId: request.query.teamId }) })),
  get: action(async (request, response) => send(response, { player: await service.getById(request.params.id) })),
  create: action(async (request, response) => send(response, { player: await service.create(request.body) }, 201)),
  update: action(async (request, response) => send(response, { player: await service.update(request.params.id, request.body) })),
  remove: action(async (request, response) => send(response, { player: await service.remove(request.params.id) })),
});

export const createMatchController = (service = matchService) => ({
  list: action(async (request, response) => send(response, {
    matches: await service.list({ filter: request.query.filter ?? 'all', tournamentId: request.query.tournamentId }),
  })),
  get: action(async (request, response) => send(response, { match: await service.getById(request.params.id) })),
  create: action(async (request, response) => send(response, { match: await service.create(request.body) }, 201)),
  update: action(async (request, response) => send(response, { match: await service.update(request.params.id, request.body) })),
});

export const createLineupController = (service = lineupService) => ({
  get: action(async (request, response) => send(response, await service.get(request.params.id))),
  save: action(async (request, response) => send(response, await service.save(request.params.id, request.body))),
});

export const createScoringController = (service = scoringService) => ({
  start: action(async (request, response) => sendMatchAction(request, response, await service.start(request.params.id, request.body, request.auth.sub))),
  raid: action(async (request, response) => sendMatchAction(request, response, await service.raid(request.params.id, request.body, request.auth.sub))),
  tackle: action(async (request, response) => sendMatchAction(request, response, await service.tackle(request.params.id, request.body, request.auth.sub))),
  technicalPoint: action(async (request, response) => sendMatchAction(request, response, await service.technicalPoint(request.params.id, request.body, request.auth.sub))),
  substitute: action(async (request, response) => sendMatchAction(request, response, await service.substitute(request.params.id, request.body, request.auth.sub))),
});

export const createAuditController = (service = auditService) => ({
  latest: action(async (request, response) => send(response, { event: await service.latest(request.params.id) })),
  list: action(async (request, response) => send(response, { events: await service.list(request.params.id, request.query) })),
  correction: action(async (request, response) => sendMatchAction(request, response, await service.correction(request.params.id, request.body, request.auth.sub))),
  undo: action(async (request, response) => sendMatchAction(request, response, await service.undo(request.params.id, request.body, request.auth.sub))),
});

export const createMatchLifecycleController = (service = matchLifecycleService) => ({
  runTimer: action(async (request, response) => sendMatchAction(request, response, await service.runTimer(request.params.id, request.body, request.auth.sub))),
  pauseTimer: action(async (request, response) => sendMatchAction(request, response, await service.pauseTimer(request.params.id, request.body, request.auth.sub))),
  endFirstHalf: action(async (request, response) => sendMatchAction(request, response, await service.endFirstHalf(request.params.id, request.body, request.auth.sub))),
  startSecondHalf: action(async (request, response) => sendMatchAction(request, response, await service.startSecondHalf(request.params.id, request.body, request.auth.sub))),
  endMatch: action(async (request, response) => sendMatchAction(request, response, await service.endMatch(request.params.id, request.body, request.auth.sub))),
  reopen: action(async (request, response) => sendMatchAction(request, response, await service.reopen(request.params.id, request.body, request.auth.sub))),
});
