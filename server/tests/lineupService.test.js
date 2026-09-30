import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { validateLineupSubmission, validateTeamLineup } from '../src/services/lineupService.js';

const ids = (count) => Array.from({ length: count }, () => new mongoose.Types.ObjectId());
const settings = { numberOfPlayersOnCourt: 7, maximumSquadSize: 12 };

test('team lineup accepts exactly seven starters, substitutes, and a selected captain', () => {
  const registered = ids(10);
  assert.doesNotThrow(() => validateTeamLineup({
    lineup: { startingSeven: registered.slice(0, 7), substitutes: registered.slice(7), captain: registered[0] },
    registeredPlayerIds: registered,
    settings,
    teamLabel: 'Team A',
  }));
});

test('team lineup rejects wrong starter count, duplicates, oversized squads, and outsiders', () => {
  const registered = ids(13);
  assert.throws(() => validateTeamLineup({ lineup: { startingSeven: registered.slice(0, 6), substitutes: [], captain: registered[0] }, registeredPlayerIds: registered, settings, teamLabel: 'Team A' }), /exactly 7/);
  assert.throws(() => validateTeamLineup({ lineup: { startingSeven: [...registered.slice(0, 6), registered[0]], substitutes: [], captain: registered[0] }, registeredPlayerIds: registered, settings, teamLabel: 'Team A' }), /duplicate/);
  assert.throws(() => validateTeamLineup({ lineup: { startingSeven: registered.slice(0, 7), substitutes: registered.slice(7, 13), captain: registered[0] }, registeredPlayerIds: registered, settings, teamLabel: 'Team A' }), /cannot exceed 12/);
  assert.throws(() => validateTeamLineup({ lineup: { startingSeven: [...registered.slice(0, 6), new mongoose.Types.ObjectId()], substitutes: [], captain: registered[0] }, registeredPlayerIds: registered, settings, teamLabel: 'Team A' }), /outside its registered squad/);
});

test('team lineup requires its captain to be in the selected squad', () => {
  const registered = ids(8);
  assert.throws(() => validateTeamLineup({
    lineup: { startingSeven: registered.slice(0, 7), substitutes: [], captain: registered[7] },
    registeredPlayerIds: registered, settings, teamLabel: 'Team B',
  }), /captain must be selected/);
});

test('submission requires a valid pre-match state and first raiding team', () => {
  const teamA = new mongoose.Types.ObjectId();
  const teamB = new mongoose.Types.ObjectId();
  const teamAPlayers = ids(7);
  const teamBPlayers = ids(7);
  const lineup = (players) => ({ startingSeven: players, substitutes: [], captain: players[0] });
  const base = {
    match: { status: 'scheduled', teamA, teamB }, tournament: { settings },
    teamALineup: lineup(teamAPlayers), teamBLineup: lineup(teamBPlayers), teamAPlayerIds: teamAPlayers, teamBPlayerIds: teamBPlayers,
  };
  assert.throws(() => validateLineupSubmission({ ...base, firstRaidingTeam: new mongoose.Types.ObjectId() }), /one of the teams/);
  assert.throws(() => validateLineupSubmission({ ...base, match: { ...base.match, status: 'live' }, firstRaidingTeam: teamA }), /after the match has started/);
  assert.doesNotThrow(() => validateLineupSubmission({ ...base, firstRaidingTeam: teamB }));
});
