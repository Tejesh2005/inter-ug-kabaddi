import { authenticateAdmin as defaultAuthenticateAdmin } from '../services/authService.js';
import {
  AUTH_COOKIE,
  authCookieOptions,
  clearAuthCookieOptions,
  createAccessToken,
} from '../services/tokenService.js';
import { createHttpError } from '../utils/httpError.js';

const publicAdmin = (admin) => ({
  id: admin._id.toString(),
  name: admin.name,
  email: admin.email,
  role: admin.role,
});

export const createAuthController = ({ authenticateAdmin = defaultAuthenticateAdmin } = {}) => ({
  login: async (request, response, next) => {
    try {
      const email = request.body?.email?.trim();
      const password = request.body?.password;
      if (!email || !password) throw createHttpError(400, 'Email and password are required');
      if (typeof password !== 'string' || password.length > 128) throw createHttpError(400, 'Invalid login request');

      const admin = await authenticateAdmin(email, password);
      const token = createAccessToken(admin);
      response.cookie(AUTH_COOKIE, token, authCookieOptions());
      response.json({ success: true, data: { admin: publicAdmin(admin) } });
    } catch (error) {
      next(error);
    }
  },

  me: (request, response) => {
    response.json({
      success: true,
      data: {
        admin: {
          id: request.auth.sub,
          name: request.auth.name,
          email: request.auth.email,
          role: request.auth.role,
        },
      },
    });
  },

  logout: (_request, response) => {
    response.clearCookie(AUTH_COOKIE, clearAuthCookieOptions());
    response.json({ success: true, message: 'Signed out successfully' });
  },
});
