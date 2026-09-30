export const createHttpError = (status, message) => Object.assign(new Error(message), { status });
