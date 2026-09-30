export const notFound = (request, response) => {
  response.status(404).json({
    success: false,
    message: `Route not found: ${request.method} ${request.originalUrl}`,
  });
};

export const errorHandler = (error, _request, response, _next) => {
  let status = error.status ?? 500;
  let message = error.status ? error.message : 'Unexpected server error';

  if (error.name === 'ValidationError') {
    status = 400;
    message = Object.values(error.errors).map((issue) => issue.message).join('; ');
  } else if (error.name === 'CastError') {
    status = 400;
    message = `Invalid ${error.path}`;
  } else if (error.code === 11000) {
    status = 409;
    const field = Object.keys(error.keyPattern ?? error.keyValue ?? {})[0] ?? 'value';
    message = `A record with that ${field} already exists`;
  }

  if (status >= 500) console.error(error);
  response.status(status).json({
    success: false,
    message,
  });
};
