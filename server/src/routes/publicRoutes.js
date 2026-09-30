import { Router } from 'express';
import { createPublicController } from '../controllers/publicController.js';
import { validateObjectId } from '../middleware/validateObjectId.js';

export const createPublicRoutes = (service) => {
  const router = Router();
  const publicViews = createPublicController(service);
  router.get('/home', publicViews.home);
  router.get('/matches', publicViews.matches);
  router.get('/matches/:id', validateObjectId(), publicViews.match);
  router.get('/matches/:id/events', validateObjectId(), publicViews.events);
  router.get('/tournaments/:id/standings', validateObjectId(), publicViews.standings);
  router.get('/tournaments/:id/leaderboards', validateObjectId(), publicViews.leaderboards);
  router.get('/teams/:id', validateObjectId(), publicViews.team);
  router.get('/players/:id', validateObjectId(), publicViews.player);
  return router;
};

export default createPublicRoutes();
