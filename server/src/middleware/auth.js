import { createHttpError } from '../utils/httpError.js';
import { AUTH_COOKIE, verifyAccessToken } from '../services/tokenService.js';

const getToken = (request) => {
  const authorization = request.get('authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim();
  return request.cookies?.[AUTH_COOKIE] ?? null;
};

export const requireAuth = (request, _response, next) => {
  const token = getToken(request);
  if (!token) return next(createHttpError(401, 'Authentication required'));

  try {
    request.auth = verifyAccessToken(token);
    return next();
  } catch {
    return next(createHttpError(401, 'Invalid or expired session'));
  }
};

export const authorizeRoles = (...allowedRoles) => (request, _response, next) => {
  if (!request.auth || !allowedRoles.includes(request.auth.role)) {
    return next(createHttpError(403, 'You do not have permission to perform this action'));
  }
  return next();
};
