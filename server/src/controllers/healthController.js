import { getDatabaseStatus } from '../config/database.js';

export const getHealth = (_request, response) => {
  response.status(200).json({
    success: true,
    message: 'Inter UG Kabaddi API is ready',
    data: {
      service: 'inter-ug-kabaddi-api',
      status: 'ok',
      database: getDatabaseStatus(),
      timestamp: new Date().toISOString(),
    },
  });
};
