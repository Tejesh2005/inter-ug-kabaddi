import { createHttpError } from '../utils/httpError.js';

const id = (value) => value?.toString();
const ids = (values = []) => values.map(id);
const unique = (values) => [...new Set(values)];
// JSON cloning intentionally normalizes Mongoose ObjectIds to their hex strings.
// Dates are cast back by Mongoose when the calculated state is persisted.
const clone = (value) => JSON.parse(JSON.stringify(value));

const requireLiveMatch = (match) => {
  if (!match) throw createHttpError(404, 'Match not found');
  if (match.status !== 'live' || !['first', 'second'].includes(match.currentHalf)) {
    throw createHttpError(409, 'Scoring is only available during a live half');
  }
};

const sideForTeam = (match, teamId) => {
  if (id(match.teamA) === id(teamId)) return 'A';
  if (id(match.teamB) === id(teamId)) return 'B';
  throw createHttpError(400, 'Team is not part of this match');
};

const fieldsForSide = (side) => ({
  score: `team${side}Score`,
  court: `team${side}PlayersOnCourt`,
  out: `team${side}OutPlayers`,
  queue: `team${side}RevivalQueue`,
  substituted: `team${side}SubstitutedOutPlayers`,
});

const opposingSide = (side) => (side === 'A' ? 'B' : 'A');
const teamForSide = (match, side) => id(side === 'A' ? match.teamA : match.teamB);

const normalizeMatch = (source) => {
  const match = clone(source);
  for (const side of ['A', 'B']) {
    const fields = fieldsForSide(side);
    match[fields.court] = ids(match[fields.court]);
    match[fields.out] = ids(match[fields.out]);
    match[fields.queue] = ids(match[fields.queue]);
    match[fields.substituted] = ids(match[fields.substituted]);
  }
  match.teamA = id(match.teamA);
  match.teamB = id(match.teamB);
  match.currentRaidingTeam = id(match.currentRaidingTeam);
  match.currentRaider = id(match.currentRaider);
  return match;
};

const addPoints = (match, side, points) => {
  const { score } = fieldsForSide(side);
  match[score] += points;
};

const takeOut = (match, side, playerIds) => {
  const fields = fieldsForSide(side);
  const selected = new Set(playerIds);
  match[fields.court] = match[fields.court].filter((playerId) => !selected.has(playerId));
  for (const playerId of playerIds) {
    if (!match[fields.out].includes(playerId)) match[fields.out].push(playerId);
    if (!match[fields.queue].includes(playerId)) match[fields.queue].push(playerId);
  }
};

const revive = (match, side, count) => {
  const fields = fieldsForSide(side);
  const revived = [];
  while (revived.length < count && match[fields.queue].length) {
    const playerId = match[fields.queue].shift();
    const outIndex = match[fields.out].indexOf(playerId);
    if (outIndex >= 0) match[fields.out].splice(outIndex, 1);
    if (!match[fields.court].includes(playerId)) match[fields.court].push(playerId);
    revived.push(playerId);
  }
  return revived;
};

const resetAllOutTeam = (match, side, lineups) => {
  const fields = fieldsForSide(side);
  const teamId = teamForSide(match, side);
  const lineup = lineups.find((candidate) => id(candidate.teamId) === teamId);
  if (!lineup) throw createHttpError(409, 'Match lineup is missing for all-out reset');
  match[fields.court] = match[fields.substituted].length
    ? unique([...match[fields.court], ...match[fields.out]])
    : ids(lineup.startingSeven);
  match[fields.out] = [];
  match[fields.queue] = [];
};

const finishRaid = (match) => {
  match.currentRaidingTeam = id(match.currentRaidingTeam) === match.teamA ? match.teamB : match.teamA;
  match.currentRaider = null;
  match.raidNumber += 1;
};

const scoreChanges = (before, after) => ({
  teamAPointsChange: after.teamAScore - before.teamAScore,
  teamBPointsChange: after.teamBScore - before.teamBScore,
  teamAScoreAfter: after.teamAScore,
  teamBScoreAfter: after.teamBScore,
});

const playerDelta = (playerId, changes) => ({ playerId, changes });

const validateRaider = (match, raiderId) => {
  const raidingSide = sideForTeam(match, match.currentRaidingTeam);
  const court = match[fieldsForSide(raidingSide).court];
  if (!raiderId || !court.includes(id(raiderId))) throw createHttpError(400, 'Raider must be an active on-court player');
  return raidingSide;
};

const detectAndApplyAllOut = ({ match, scoringSide, defendingSide, settings, lineups }) => {
  const defendingCourt = match[fieldsForSide(defendingSide).court];
  if (defendingCourt.length > 0) return { allOutPoints: 0, revived: [] };
  const points = settings.allOutPoints;
  addPoints(match, scoringSide, points);
  const revived = revive(match, scoringSide, points);
  resetAllOutTeam(match, defendingSide, lineups);
  return { allOutPoints: points, revived };
};

export const startMatch = ({ match: source, lineups, settings }) => {
  if (!source) throw createHttpError(404, 'Match not found');
  if (!['scheduled', 'upcoming'].includes(source.status)) throw createHttpError(409, 'Only a scheduled match can be started');
  const match = normalizeMatch(source);
  const teamALineup = lineups.find((lineup) => id(lineup.teamId) === match.teamA);
  const teamBLineup = lineups.find((lineup) => id(lineup.teamId) === match.teamB);
  if (!teamALineup || !teamBLineup) throw createHttpError(409, 'Both match lineups must be confirmed before starting');
  if (![match.teamA, match.teamB].includes(match.currentRaidingTeam)) throw createHttpError(409, 'First raiding team must be selected');

  match.status = 'live';
  match.currentHalf = 'first';
  match.teamAPlayersOnCourt = ids(teamALineup.startingSeven);
  match.teamBPlayersOnCourt = ids(teamBLineup.startingSeven);
  match.teamAOutPlayers = [];
  match.teamBOutPlayers = [];
  match.teamARevivalQueue = [];
  match.teamBRevivalQueue = [];
  match.teamASubstitutedOutPlayers = [];
  match.teamBSubstitutedOutPlayers = [];
  match.raidNumber = 1;
  match.startedAt = new Date();
  match.timerState = { status: 'stopped', remainingMilliseconds: settings.halfDuration * 60_000, startedAt: null, pausedAt: null };
  return { match, event: { type: 'MATCH_START', description: 'Match started', ...scoreChanges(source, match) }, playerUpdates: [] };
};

export const applyRaid = ({ match: source, settings, lineups, payload, consecutiveEmptyRaids = 0 }) => {
  requireLiveMatch(source);
  const before = normalizeMatch(source);
  const match = clone(before);
  const raiderId = id(payload.raiderId);
  const raidingSide = validateRaider(match, raiderId);
  const defendingSide = opposingSide(raidingSide);
  const defendingFields = fieldsForSide(defendingSide);
  const touched = unique(ids(payload.touchedPlayerIds));
  if (touched.some((playerId) => !match[defendingFields.court].includes(playerId))) {
    throw createHttpError(400, 'Touched players must be active defenders');
  }
  const bonus = Boolean(payload.bonus);
  if (bonus && !settings.bonusEnabled) throw createHttpError(400, 'Bonus points are disabled for this tournament');
  const isDoOrDie = Boolean(settings.doOrDieEnabled && consecutiveEmptyRaids >= (settings.doOrDieAfterEmptyRaids ?? 2));
  if (!touched.length && !bonus && isDoOrDie) {
    return applyTackle({ match: source, settings, lineups, payload: { raiderId, doOrDie: true } });
  }

  takeOut(match, defendingSide, touched);
  const touchPoints = touched.length;
  const bonusPoint = bonus ? 1 : 0;
  const raidPoints = touchPoints + bonusPoint;
  addPoints(match, raidingSide, raidPoints);
  const revived = revive(match, raidingSide, touchPoints);
  const allOut = detectAndApplyAllOut({ match, scoringSide: raidingSide, defendingSide, settings, lineups });
  revived.push(...allOut.revived);
  const isSuperRaid = Boolean(settings.superRaidEnabled && raidPoints >= (settings.superRaidMinimumPoints ?? 3));
  const type = touched.length ? 'RAID_TOUCH' : bonus ? 'RAID_BONUS' : 'EMPTY_RAID';
  finishRaid(match);

  const raidChanges = {
    'raidStats.totalRaids': 1,
    [raidPoints ? 'raidStats.successfulRaids' : 'raidStats.emptyRaids']: 1,
    'raidStats.raidPoints': raidPoints,
    'raidStats.touchPoints': touchPoints,
    'raidStats.bonusPoints': bonusPoint,
    ...(isSuperRaid ? { 'raidStats.superRaids': 1 } : {}),
    ...(isDoOrDie ? { 'raidStats.doOrDieRaids': 1, 'raidStats.doOrDieRaidPoints': raidPoints } : {}),
    totalPoints: raidPoints,
  };
  return {
    match,
    event: {
      type: allOut.allOutPoints ? 'ALL_OUT' : type,
      raidingTeam: teamForSide(match, raidingSide),
      defendingTeam: teamForSide(match, defendingSide),
      raiderId,
      touchedPlayers: touched,
      playerOutIds: touched,
      playerRevivedIds: unique(revived),
      bonusPoint,
      raidPoints,
      allOutPoints: allOut.allOutPoints,
      isSuperRaid,
      isDoOrDie,
      description: type === 'EMPTY_RAID' ? 'Empty raid' : `${touchPoints} touch point${touchPoints === 1 ? '' : 's'}${bonus ? ' plus bonus' : ''}`,
      ...scoreChanges(before, match),
    },
    playerUpdates: [playerDelta(raiderId, raidChanges)],
  };
};

export const applyTackle = ({ match: source, settings, lineups, payload }) => {
  requireLiveMatch(source);
  const before = normalizeMatch(source);
  const match = clone(before);
  const raiderId = id(payload.raiderId);
  const raidingSide = validateRaider(match, raiderId);
  const defendingSide = opposingSide(raidingSide);
  const defendingCourt = match[fieldsForSide(defendingSide).court];
  const tacklerId = id(payload.tacklerId);
  if (!payload.doOrDie && (!tacklerId || !defendingCourt.includes(tacklerId))) {
    throw createHttpError(400, 'Primary tackler must be an active defender');
  }
  const assists = unique(ids(payload.assistPlayerIds));
  if (assists.some((playerId) => playerId === tacklerId || !defendingCourt.includes(playerId))) {
    throw createHttpError(400, 'Assist players must be distinct active defenders');
  }
  const isSuperTackle = !payload.doOrDie && settings.superTackleEnabled && defendingCourt.length <= (settings.superTackleThreshold ?? 3);
  const tacklePoints = payload.overridePoints ?? (isSuperTackle ? settings.superTacklePoints : settings.normalTacklePoints);
  if (!Number.isInteger(tacklePoints) || tacklePoints < 1) throw createHttpError(400, 'Tackle points must be a positive integer');

  takeOut(match, raidingSide, [raiderId]);
  addPoints(match, defendingSide, tacklePoints);
  const revived = revive(match, defendingSide, tacklePoints);
  const allOut = detectAndApplyAllOut({ match, scoringSide: defendingSide, defendingSide: raidingSide, settings, lineups });
  revived.push(...allOut.revived);
  finishRaid(match);

  const playerUpdates = [playerDelta(raiderId, {
    'raidStats.totalRaids': 1,
    'raidStats.unsuccessfulRaids': 1,
    ...(payload.doOrDie ? { 'raidStats.doOrDieRaids': 1 } : {}),
  })];
  if (tacklerId) playerUpdates.push(playerDelta(tacklerId, {
    'defenceStats.tacklesAttempted': 1,
    'defenceStats.successfulTackles': 1,
    'defenceStats.tacklePoints': tacklePoints,
    ...(isSuperTackle ? { 'defenceStats.superTackles': 1 } : {}),
    totalPoints: tacklePoints,
  }));

  return {
    match,
    event: {
      type: allOut.allOutPoints ? 'ALL_OUT' : isSuperTackle ? 'SUPER_TACKLE' : 'TACKLE',
      raidingTeam: teamForSide(match, raidingSide),
      defendingTeam: teamForSide(match, defendingSide),
      raiderId,
      tacklerId: tacklerId ?? null,
      assistPlayers: assists,
      playerOutIds: [raiderId],
      playerRevivedIds: unique(revived),
      tacklePoints,
      allOutPoints: allOut.allOutPoints,
      isDoOrDie: Boolean(payload.doOrDie),
      description: payload.doOrDie ? 'Do-or-die raid failed' : isSuperTackle ? 'Super tackle' : 'Successful tackle',
      ...scoreChanges(before, match),
    },
    playerUpdates,
  };
};

export const applyTechnicalPoint = ({ match: source, payload }) => {
  requireLiveMatch(source);
  if (!payload.reason?.trim()) throw createHttpError(400, 'Technical point reason is required');
  const before = normalizeMatch(source);
  const match = clone(before);
  const side = sideForTeam(match, payload.teamId);
  const points = payload.points ?? 1;
  if (!Number.isInteger(points) || points < 1) throw createHttpError(400, 'Technical points must be a positive integer');
  addPoints(match, side, points);
  return {
    match,
    event: {
      type: 'TECHNICAL_POINT',
      technicalPoints: points,
      description: `Technical point: ${payload.reason.trim()}`,
      ...scoreChanges(before, match),
    },
    playerUpdates: [],
  };
};

export const applySubstitution = ({ match: source, lineups, payload }) => {
  requireLiveMatch(source);
  const before = normalizeMatch(source);
  const match = clone(before);
  const side = sideForTeam(match, payload.teamId);
  const fields = fieldsForSide(side);
  const outgoingPlayerId = id(payload.outgoingPlayerId);
  const incomingPlayerId = id(payload.incomingPlayerId);
  if (!outgoingPlayerId || !incomingPlayerId || outgoingPlayerId === incomingPlayerId) {
    throw createHttpError(400, 'Choose different outgoing and incoming players');
  }
  if (!match[fields.court].includes(outgoingPlayerId)) throw createHttpError(400, 'Outgoing player must be on court');
  const lineup = lineups.find((candidate) => id(candidate.teamId) === id(payload.teamId));
  if (!lineup || !ids(lineup.substitutes).includes(incomingPlayerId)) {
    throw createHttpError(400, 'Incoming player must be a registered substitute');
  }
  if (match[fields.court].includes(incomingPlayerId) || match[fields.substituted].includes(incomingPlayerId)) {
    throw createHttpError(400, 'Incoming player is not eligible for substitution');
  }
  match[fields.court] = match[fields.court].map((playerId) => playerId === outgoingPlayerId ? incomingPlayerId : playerId);
  match[fields.substituted].push(outgoingPlayerId);
  return {
    match,
    event: {
      type: 'SUBSTITUTION',
      playerOutIds: [outgoingPlayerId],
      playerRevivedIds: [incomingPlayerId],
      description: 'Player substitution',
      ...scoreChanges(before, match),
    },
    playerUpdates: [],
  };
};

export const scoringEngine = { startMatch, applyRaid, applyTackle, applyTechnicalPoint, applySubstitution };
