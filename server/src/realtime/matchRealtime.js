const matchIdPattern = /^[a-f\d]{24}$/i;
const timerEvents = new Set(['TIMER_START', 'TIMER_PAUSE', 'TIMER_RESUME']);
const raidEvents = new Set(['RAID_TOUCH', 'RAID_BONUS', 'EMPTY_RAID', 'TACKLE', 'SUPER_TACKLE', 'ALL_OUT']);
const matchEvents = new Map([
  ['MATCH_START', 'match:started'],
  ['FIRST_HALF_END', 'match:halftime'],
  ['SECOND_HALF_START', 'match:started'],
  ['MATCH_END', 'match:ended'],
]);

export const matchRoom = (matchId) => `match:${matchId}`;
export const isMatchId = (value) => typeof value === 'string' && matchIdPattern.test(value);

export const createMatchRealtime = (io) => {
  const broadcast = ({ match, event, duplicate = false }) => {
    if (!match?._id || duplicate) return;
    const payload = { match, event };
    const room = io.to(matchRoom(match._id.toString()));
    room.emit('match:state', payload);
    room.emit('match:update', payload);
    if (event?.teamAPointsChange || event?.teamBPointsChange) room.emit('score:update', payload);
    if (raidEvents.has(event?.type)) room.emit('raid:update', payload);
    if (raidEvents.has(event?.type) || event?.playerStatChanges?.length) room.emit('player:update', payload);
    if (timerEvents.has(event?.type)) room.emit('timer:update', payload);
    const namedEvent = matchEvents.get(event?.type);
    if (namedEvent) room.emit(namedEvent, payload);
  };

  const register = () => {
    io.on('connection', (socket) => {
      socket.emit('connection:status', { connected: true });
      socket.on('match:join', (matchId, acknowledge) => {
        if (!isMatchId(matchId)) {
          acknowledge?.({ ok: false, message: 'Invalid match id' });
          return;
        }
        socket.join(matchRoom(matchId));
        socket.emit('match:joined', { matchId });
        acknowledge?.({ ok: true, matchId });
      });
      socket.on('match:leave', (matchId) => {
        if (isMatchId(matchId)) socket.leave(matchRoom(matchId));
      });
    });
  };

  return { register, broadcast };
};
