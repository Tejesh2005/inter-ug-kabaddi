import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStandings } from '../src/services/publicService.js';

const teams = [{ _id: 'a', name: 'UG One', shortName: 'UG1' }, { _id: 'b', name: 'UG Two', shortName: 'UG2' }, { _id: 'c', name: 'UG Three', shortName: 'UG3' }];
const rules = { primary: 'leaguePoints', secondary: 'scoreDifference', tertiary: 'pointsFor' };
const points = { winPoints: 5, drawPoints: 3, lossPoints: 0, closeLossEnabled: true, closeLossMargin: 2, closeLossPoints: 1 };

test('standings calculate configured points, form, and ranking tie-breakers from completed matches', () => {
  const standings = calculateStandings({ teams, pointsSystem: points, standingsRules: rules, matches: [
    { status: 'completed', teamA: 'a', teamB: 'b', teamAScore: 30, teamBScore: 28 },
    { status: 'completed', teamA: 'c', teamB: 'a', teamAScore: 25, teamBScore: 25 },
    { status: 'completed', teamA: 'b', teamB: 'c', teamAScore: 19, teamBScore: 21 },
  ] });
  assert.deepEqual(standings.map((row) => row.team.shortName), ['UG1', 'UG3', 'UG2']);
  assert.equal(standings[0].leaguePoints, 8);
  assert.deepEqual(standings[0].form, ['W', 'D']);
  assert.equal(standings[2].leaguePoints, 2);
});
