import bcrypt from 'bcrypt';

const HASH_ROUNDS = 12;

export const hashPassword = (password) => bcrypt.hash(password, HASH_ROUNDS);

export const verifyPassword = (password, passwordHash) => bcrypt.compare(password, passwordHash);
