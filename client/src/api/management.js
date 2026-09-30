import http from './http';

const unwrap = (request, key) => request.then((response) => response.data.data[key]);

export const tournamentApi = {
  list: () => unwrap(http.get('/tournaments'), 'tournaments'),
  create: (payload) => unwrap(http.post('/tournaments', payload), 'tournament'),
  update: (id, payload) => unwrap(http.put(`/tournaments/${id}`, payload), 'tournament'),
};

export const teamApi = {
  list: () => unwrap(http.get('/teams'), 'teams'),
  get: (id) => unwrap(http.get(`/teams/${id}`), 'team'),
  create: (payload) => unwrap(http.post('/teams', payload), 'team'),
  update: (id, payload) => unwrap(http.put(`/teams/${id}`, payload), 'team'),
  remove: (id) => unwrap(http.delete(`/teams/${id}`), 'team'),
};

export const playerApi = {
  create: (payload) => unwrap(http.post('/players', payload), 'player'),
  update: (id, payload) => unwrap(http.put(`/players/${id}`, payload), 'player'),
  remove: (id) => unwrap(http.delete(`/players/${id}`), 'player'),
};

export const matchApi = {
  list: (filter = 'all', tournamentId) => unwrap(http.get('/matches', { params: { filter, tournamentId } }), 'matches'),
  get: (id) => unwrap(http.get(`/matches/${id}`), 'match'),
  create: (payload) => unwrap(http.post('/matches', payload), 'match'),
  update: (id, payload) => unwrap(http.put(`/matches/${id}`, payload), 'match'),
};

export const lineupApi = {
  get: (matchId) => http.get(`/matches/${matchId}/lineups`).then((response) => response.data.data),
  save: (matchId, payload) => http.post(`/matches/${matchId}/lineups`, payload).then((response) => response.data.data),
};

const scoringRequest = (request) => request.then((response) => response.data.data);

export const scoringApi = {
  start: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/start`, payload)),
  raid: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/raid`, payload)),
  tackle: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/tackle`, payload)),
  technicalPoint: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/technical-point`, payload)),
  substitute: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/substitute`, payload)),
  correction: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/correction`, payload)),
  undo: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/undo`, payload)),
  latestEvent: (matchId) => unwrap(http.get(`/matches/${matchId}/events/latest`), 'event'),
  timerStart: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/timer/start`, payload)),
  timerPause: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/timer/pause`, payload)),
  timerResume: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/timer/resume`, payload)),
  firstHalfEnd: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/first-half/end`, payload)),
  secondHalfStart: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/second-half/start`, payload)),
  endMatch: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/end`, payload)),
  reopen: (matchId, payload) => scoringRequest(http.post(`/matches/${matchId}/reopen`, payload)),
};

export const auditApi = {
  list: (matchId, limit = 50) => unwrap(http.get(`/matches/${matchId}/events`, { params: { limit } }), 'events'),
};
