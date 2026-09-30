import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Admin, Match, MatchEvent, MatchLineup, Player, Team, Tournament } from '../src/models/index.js';

const id = () => new mongoose.Types.ObjectId();

const baseTournament = () => ({
  name: 'Inter UG Kabaddi Championship 2026',
  shortName: 'IUGKC',
  venue: 'College Indoor Stadium',
  startDate: new Date('2026-10-01'),
  endDate: new Date('2026-10-05'),
  format: 'league_knockout',
});

test('all Phase 2 models create valid documents with expected defaults', async () => {
  const tournament = new Tournament(baseTournament());
  assert.equal(await tournament.validate(), undefined);
  assert.equal(tournament.settings.numberOfPlayersOnCourt, 7);

  const teamAId = id();
  const teamBId = id();
  const playerId = id();
  const adminId = id();
  const matchId = id();

  const team = new Team({
    _id: teamAId, name: 'Undergraduate One', shortName: 'ug1', departmentOrUG: 'UG1',
    primaryColor: '#B8F246', secondaryColor: '#07111F',
  });
  assert.equal(await team.validate(), undefined);
  assert.equal(team.shortName, 'UG1');

  const player = new Player({
    _id: playerId, name: 'Rahul Kumar', jerseyNumber: 7, teamId: teamAId, role: 'Raider',
  });
  assert.equal(await player.validate(), undefined);
  assert.equal(player.raidStats.raidPoints, 0);

  const match = new Match({
    _id: matchId, tournamentId: tournament._id, matchNumber: 1, teamA: teamAId, teamB: teamBId,
    stage: 'League', scheduledDate: new Date('2026-10-01'), scheduledTime: '09:30', venue: 'Court 1',
  });
  assert.equal(await match.validate(), undefined);

  const lineup = new MatchLineup({
    matchId, teamId: teamAId, startingSeven: [playerId], substitutes: [], captain: playerId,
  });
  assert.equal(await lineup.validate(), undefined);

  const admin = new Admin({
    _id: adminId, name: 'Tournament Admin', email: 'ADMIN@COLLEGE.EDU', passwordHash: 'hashed-value', role: 'SUPER_ADMIN',
  });
  assert.equal(await admin.validate(), undefined);
  assert.equal(admin.email, 'admin@college.edu');

  const event = new MatchEvent({
    matchId, actionId: randomUUID(), eventNumber: 1, raidNumber: 0, half: 'none', type: 'MATCH_START',
    teamAScoreAfter: 0, teamBScoreAfter: 0, description: 'Match started', createdBy: adminId, previousState: { status: 'scheduled' },
  });
  assert.equal(await event.validate(), undefined);
});

test('Tournament rejects invalid dates, squad settings, and duplicate ranking rules', async () => {
  const tournament = new Tournament({
    ...baseTournament(),
    startDate: new Date('2026-10-05'),
    endDate: new Date('2026-10-01'),
    settings: { numberOfPlayersOnCourt: 7, maximumSquadSize: 6 },
    standingsRules: { primary: 'leaguePoints', secondary: 'leaguePoints', tertiary: 'pointsFor' },
  });

  await assert.rejects(tournament.validate(), mongoose.Error.ValidationError);
  assert.ok(tournament.errors.endDate);
  assert.ok(tournament.errors['settings.maximumSquadSize']);
  assert.ok(tournament.errors.standingsRules);
});

test('Team derives score difference and rejects inconsistent match totals', async () => {
  const team = new Team({
    name: 'UG Two', shortName: 'UG2', departmentOrUG: 'UG2', primaryColor: '#112233', secondaryColor: '#FFFFFF',
    matchesPlayed: 2, wins: 1, losses: 0, draws: 0, pointsFor: 50, pointsAgainst: 40,
  });

  await assert.rejects(team.validate(), /Matches played must equal/);
  assert.equal(team.scoreDifference, 10);
});

test('Team rejects a captain outside its registered player list', async () => {
  const team = new Team({
    name: 'UG Three', shortName: 'UG3', departmentOrUG: 'UG3', primaryColor: '#112233', secondaryColor: '#FFFFFF',
    players: [id()], captain: id(),
  });
  await assert.rejects(team.validate(), mongoose.Error.ValidationError);
  assert.ok(team.errors.captain);
});

test('Player rejects invalid leadership and exposes the compound jersey index', async () => {
  const player = new Player({
    name: 'Arjun Rao', jerseyNumber: 4, teamId: id(), role: 'Defender', isCaptain: true, isViceCaptain: true,
  });
  await assert.rejects(player.validate(), /cannot be both captain and vice captain/);

  const jerseyIndex = Player.schema.indexes().find(([keys]) => keys.teamId === 1 && keys.jerseyNumber === 1);
  assert.equal(jerseyIndex?.[1]?.unique, true);
});

test('Player rejects a total that disagrees with raid and tackle points', async () => {
  const player = new Player({
    name: 'Sai Patel', jerseyNumber: 10, teamId: id(), role: 'All-Rounder',
    raidStats: { raidPoints: 3 }, defenceStats: { tacklePoints: 2 }, totalPoints: 4,
  });
  await assert.rejects(player.validate(), mongoose.Error.ValidationError);
  assert.ok(player.errors.totalPoints);
});

test('Match rejects self-play, invalid time, and duplicate on-court players', async () => {
  const teamId = id();
  const playerId = id();
  const match = new Match({
    tournamentId: id(), matchNumber: 2, teamA: teamId, teamB: teamId, stage: 'League',
    scheduledDate: new Date(), scheduledTime: '25:10', venue: 'Court 1', teamAPlayersOnCourt: [playerId, playerId],
  });
  await assert.rejects(match.validate(), mongoose.Error.ValidationError);
  assert.ok(match.errors.teamB);
  assert.ok(match.errors.scheduledTime);
  assert.ok(match.errors.teamAPlayersOnCourt);
});

test('Match rejects a player appearing as both active and out', async () => {
  const playerId = id();
  const match = new Match({
    tournamentId: id(), matchNumber: 3, teamA: id(), teamB: id(), stage: 'League',
    scheduledDate: new Date(), scheduledTime: '18:30', venue: 'Court 2',
    teamAPlayersOnCourt: [playerId], teamAOutPlayers: [playerId],
  });
  await assert.rejects(match.validate(), mongoose.Error.ValidationError);
  assert.ok(match.errors.teamAOutPlayers);
});

test('MatchLineup rejects overlap and captain outside the squad', async () => {
  const starter = id();
  const outsider = id();
  const lineup = new MatchLineup({
    matchId: id(), teamId: id(), startingSeven: [starter], substitutes: [starter], captain: outsider,
  });
  await assert.rejects(lineup.validate(), mongoose.Error.ValidationError);
  assert.ok(lineup.errors.substitutes);
  assert.ok(lineup.errors.captain);
});

test('MatchEvent validates UUIDs, undo metadata, and duplicate-protection index', async () => {
  const event = new MatchEvent({
    matchId: id(), actionId: 'not-a-uuid', eventNumber: 1, raidNumber: 1, half: 'first', type: 'RAID_TOUCH',
    teamAScoreAfter: 1, teamBScoreAfter: 0, description: 'Touch point', createdBy: id(), previousState: {}, isUndone: true,
  });
  await assert.rejects(event.validate(), mongoose.Error.ValidationError);
  assert.ok(event.errors.actionId);
  assert.ok(event.errors.isUndone);

  const actionIndex = MatchEvent.schema.indexes().find(([keys]) => keys.actionId === 1);
  assert.equal(actionIndex?.[1]?.unique, true);
});

test('Admin password hashes are excluded from normal queries and emails are unique', () => {
  assert.equal(Admin.schema.path('passwordHash').options.select, false);
  const emailIndex = Admin.schema.indexes().find(([keys]) => keys.email === 1);
  assert.equal(emailIndex?.[1]?.unique, true);
});
