import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

export const createAuthRoutes = (dependencies) => {
  const router = Router();
  const controller = createAuthController(dependencies);

  router.post('/login', controller.login);
  router.get('/me', requireAuth, controller.me);
  router.post('/logout', controller.logout);

  return router;
};

export default createAuthRoutes();
