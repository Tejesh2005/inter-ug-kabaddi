import mongoose from 'mongoose';
import { createHttpError } from '../utils/httpError.js';

export const validateObjectId = (parameter = 'id') => (request, _response, next) => {
  if (!mongoose.isObjectIdOrHexString(request.params[parameter])) {
    return next(createHttpError(400, `Invalid ${parameter}`));
  }
  return next();
};
