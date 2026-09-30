import http from './http';

const unwrap = (request, key) => request.then((response) => key ? response.data.data[key] : response.data.data);

export const publicApi = {
  home: () => unwrap(http.get('/public/home')),
  matches: (filter = 'all') => unwrap(http.get('/public/matches', { params: { filter } }), 'matches'),
  match: (matchId) => unwrap(http.get(`/public/matches/${matchId}`), 'match'),
  events: (matchId) => unwrap(http.get(`/public/matches/${matchId}/events`), 'events'),
  standings: (tournamentId) => unwrap(http.get(`/public/tournaments/${tournamentId}/standings`)),
  leaderboards: (tournamentId) => unwrap(http.get(`/public/tournaments/${tournamentId}/leaderboards`)),
  team: (teamId) => unwrap(http.get(`/public/teams/${teamId}`)),
  player: (playerId) => unwrap(http.get(`/public/players/${playerId}`), 'player'),
};
