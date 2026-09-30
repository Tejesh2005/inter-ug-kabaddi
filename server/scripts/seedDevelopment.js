import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import Tournament from '../src/models/Tournament.js';
import Team from '../src/models/Team.js';
import Player from '../src/models/Player.js';
import Match from '../src/models/Match.js';

const teamSeeds = [
  ['UG1', '#b8f246', '#153728'], ['UG2', '#4bc3ff', '#123553'], ['UG3', '#ff8d6d', '#4a2130'], ['UG4', '#ffc857', '#4b3820'],
];
const roles = ['Raider', 'Defender', 'All-Rounder'];

const findOrCreate = async (Model, filter, values) => {
  const existing = await Model.findOne(filter);
  return existing ?? Model.create(values);
};

const seed = async () => {
  if (!await connectDatabase()) throw new Error('Could not connect to MongoDB. Set MONGO_URI in server/.env first.');
  const tournament = await findOrCreate(Tournament,
    { name: 'Inter UG Kabaddi Championship 2026' },
    { name: 'Inter UG Kabaddi Championship 2026', shortName: 'INTER UG 2026', venue: 'College Sports Arena', startDate: new Date('2026-10-01'), endDate: new Date('2026-10-10'), status: 'upcoming', format: 'league' },
  );
  const teams = [];
  for (const [shortName, primaryColor, secondaryColor] of teamSeeds) {
    const team = await findOrCreate(Team,
      { shortName },
      { name: shortName, shortName, departmentOrUG: shortName, primaryColor, secondaryColor },
    );
    const players = [];
    for (let jerseyNumber = 1; jerseyNumber <= 10; jerseyNumber += 1) {
      const player = await findOrCreate(Player,
        { teamId: team._id, jerseyNumber },
        { name: `${shortName} Player ${jerseyNumber}`, jerseyNumber, teamId: team._id, role: roles[(jerseyNumber - 1) % roles.length], isCaptain: jerseyNumber === 1 },
      );
      players.push(player._id);
    }
    await Team.updateOne({ _id: team._id }, { $set: { players, captain: players[0] } });
    teams.push(team);
  }
  const fixtures = [[0, 1, 1], [2, 3, 2], [0, 2, 3], [1, 3, 4]];
  for (const [a, b, matchNumber] of fixtures) {
    await findOrCreate(Match,
      { tournamentId: tournament._id, matchNumber },
      { tournamentId: tournament._id, matchNumber, teamA: teams[a]._id, teamB: teams[b]._id, stage: 'League', scheduledDate: new Date(`2026-10-0${matchNumber + 1}`), scheduledTime: '10:00', venue: 'College Sports Arena', status: 'upcoming' },
    );
  }
  console.log(`[seed] ${tournament.name}: ${teams.length} teams, 40 players, ${fixtures.length} fixtures ready.`);
};

try { await seed(); } catch (error) { console.error(`[seed] ${error.message}`); process.exitCode = 1; } finally { await disconnectDatabase(); }
