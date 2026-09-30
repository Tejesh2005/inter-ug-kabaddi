import jwt from 'jsonwebtoken';
import { env, isProduction } from '../config/env.js';

export const AUTH_COOKIE = 'interug_token';

export const createAccessToken = (admin) => jwt.sign(
  {
    sub: admin._id.toString(),
    name: admin.name,
    email: admin.email,
    role: admin.role,
  },
  env.jwtSecret,
  { expiresIn: env.jwtExpiresIn, issuer: 'inter-ug-kabaddi-api', audience: 'inter-ug-kabaddi-admin' },
);

export const verifyAccessToken = (token) => jwt.verify(token, env.jwtSecret, {
  issuer: 'inter-ug-kabaddi-api',
  audience: 'inter-ug-kabaddi-admin',
});

export const authCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
  maxAge: 12 * 60 * 60 * 1000,
});

export const clearAuthCookieOptions = () => {
  const { maxAge: _maxAge, ...options } = authCookieOptions();
  return options;
};
