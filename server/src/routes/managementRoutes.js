import { Router } from 'express';
import { createAuditController, createLineupController, createMatchController, createMatchLifecycleController, createPlayerController, createScoringController, createTeamController, createTournamentController } from '../controllers/resourceControllers.js';
import { authorizeRoles, requireAuth } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/validateObjectId.js';

const protectManagement = [requireAuth, authorizeRoles('SUPER_ADMIN')];
const protectLineups = [requireAuth, authorizeRoles('SUPER_ADMIN', 'SCORER')];
const protectAudit = [requireAuth, authorizeRoles('SUPER_ADMIN')];

export const createManagementRoutes = ({ tournament, team, player, match, lineup, scoring, audit, lifecycle } = {}) => {
  const router = Router();
  const tournaments = createTournamentController(tournament);
  const teams = createTeamController(team);
  const players = createPlayerController(player);
  const matches = createMatchController(match);
  const lineups = createLineupController(lineup);
  const scoringActions = createScoringController(scoring);
  const auditActions = createAuditController(audit);
  const lifecycleActions = createMatchLifecycleController(lifecycle);

  router.get('/tournaments', tournaments.list);
  router.post('/tournaments', ...protectManagement, tournaments.create);
  router.get('/tournaments/:id', validateObjectId(), tournaments.get);
  router.put('/tournaments/:id', ...protectManagement, validateObjectId(), tournaments.update);

  router.get('/teams', teams.list);
  router.post('/teams', ...protectManagement, teams.create);
  router.get('/teams/:id', validateObjectId(), teams.get);
  router.put('/teams/:id', ...protectManagement, validateObjectId(), teams.update);
  router.delete('/teams/:id', ...protectManagement, validateObjectId(), teams.remove);

  router.get('/players', players.list);
  router.post('/players', ...protectManagement, players.create);
  router.get('/players/:id', validateObjectId(), players.get);
  router.put('/players/:id', ...protectManagement, validateObjectId(), players.update);
  router.delete('/players/:id', ...protectManagement, validateObjectId(), players.remove);

  router.get('/matches', matches.list);
  router.post('/matches', ...protectManagement, matches.create);
  router.get('/matches/:id', validateObjectId(), matches.get);
  router.put('/matches/:id', ...protectManagement, validateObjectId(), matches.update);
  router.get('/matches/:id/lineups', ...protectLineups, validateObjectId(), lineups.get);
  router.post('/matches/:id/lineups', ...protectLineups, validateObjectId(), lineups.save);
  router.post('/matches/:id/start', ...protectLineups, validateObjectId(), scoringActions.start);
  router.post('/matches/:id/raid', ...protectLineups, validateObjectId(), scoringActions.raid);
  router.post('/matches/:id/tackle', ...protectLineups, validateObjectId(), scoringActions.tackle);
  router.post('/matches/:id/technical-point', ...protectLineups, validateObjectId(), scoringActions.technicalPoint);
  router.post('/matches/:id/substitute', ...protectLineups, validateObjectId(), scoringActions.substitute);
  router.get('/matches/:id/events/latest', ...protectLineups, validateObjectId(), auditActions.latest);
  router.get('/matches/:id/events', ...protectAudit, validateObjectId(), auditActions.list);
  router.post('/matches/:id/undo', ...protectLineups, validateObjectId(), auditActions.undo);
  router.post('/matches/:id/correction', ...protectLineups, validateObjectId(), auditActions.correction);
  router.post('/matches/:id/timer/start', ...protectLineups, validateObjectId(), lifecycleActions.runTimer);
  router.post('/matches/:id/timer/pause', ...protectLineups, validateObjectId(), lifecycleActions.pauseTimer);
  router.post('/matches/:id/timer/resume', ...protectLineups, validateObjectId(), lifecycleActions.runTimer);
  router.post('/matches/:id/first-half/end', ...protectLineups, validateObjectId(), lifecycleActions.endFirstHalf);
  router.post('/matches/:id/second-half/start', ...protectLineups, validateObjectId(), lifecycleActions.startSecondHalf);
  router.post('/matches/:id/end', ...protectLineups, validateObjectId(), lifecycleActions.endMatch);
  router.post('/matches/:id/reopen', ...protectManagement, validateObjectId(), lifecycleActions.reopen);

  return router;
};

export default createManagementRoutes();
