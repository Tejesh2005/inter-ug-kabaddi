import mongoose from 'mongoose';
import { hasUniqueObjectIds, isValidTime, nonNegativeInteger, requiredPositiveInteger } from './shared/validators.js';

const { Schema, model, models } = mongoose;

const playerList = {
  type: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  default: [],
  validate: { validator: hasUniqueObjectIds, message: '{PATH} cannot contain duplicate players' },
};

const timerStateSchema = new Schema(
  {
    status: { type: String, enum: ['stopped', 'running', 'paused'], default: 'stopped' },
    remainingMilliseconds: { type: Number, min: 0, default: 0 },
    startedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
  },
  { _id: false },
);

const matchSchema = new Schema(
  {
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
    matchNumber: requiredPositiveInteger,
    teamA: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    teamB: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    stage: { type: String, enum: ['League', 'Quarter Final', 'Semi Final', 'Final', 'Friendly'], required: true },
    scheduledDate: { type: Date, required: true },
    scheduledTime: { type: String, required: true, validate: { validator: isValidTime, message: 'Scheduled time must use HH:mm format' } },
    venue: { type: String, required: true, trim: true, maxlength: 160 },
    status: { type: String, enum: ['scheduled', 'upcoming', 'live', 'halftime', 'completed', 'cancelled'], default: 'scheduled', index: true },
    teamAScore: nonNegativeInteger,
    teamBScore: nonNegativeInteger,
    firstHalfTeamAScore: nonNegativeInteger,
    firstHalfTeamBScore: nonNegativeInteger,
    secondHalfTeamAScore: nonNegativeInteger,
    secondHalfTeamBScore: nonNegativeInteger,
    winner: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    resultText: { type: String, trim: true, maxlength: 240, default: '' },
    currentHalf: { type: String, enum: ['not_started', 'first', 'halftime', 'second', 'completed'], default: 'not_started' },
    currentRaidingTeam: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    currentRaider: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
    raidNumber: nonNegativeInteger,
    teamAPlayersOnCourt: playerList,
    teamBPlayersOnCourt: playerList,
    teamAOutPlayers: playerList,
    teamBOutPlayers: playerList,
    teamASubstitutedOutPlayers: playerList,
    teamBSubstitutedOutPlayers: playerList,
    teamARevivalQueue: playerList,
    teamBRevivalQueue: playerList,
    teamATimeouts: nonNegativeInteger,
    teamBTimeouts: nonNegativeInteger,
    timerState: { type: timerStateSchema, default: () => ({}) },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

matchSchema.index({ tournamentId: 1, matchNumber: 1 }, { unique: true });
matchSchema.index({ tournamentId: 1, status: 1, scheduledDate: 1, scheduledTime: 1 });
matchSchema.index({ teamA: 1, scheduledDate: -1 });
matchSchema.index({ teamB: 1, scheduledDate: -1 });

matchSchema.pre('validate', function validateMatch() {
  if (this.teamA?.equals(this.teamB)) this.invalidate('teamB', 'A team cannot play itself');
  if (this.winner && !this.winner.equals(this.teamA) && !this.winner.equals(this.teamB)) {
    this.invalidate('winner', 'Winner must be one of the teams in the match');
  }
  if (this.endedAt && this.startedAt && this.endedAt < this.startedAt) {
    this.invalidate('endedAt', 'Match end time cannot be before its start time');
  }

  const statePairs = [
    ['teamAPlayersOnCourt', 'teamAOutPlayers'],
    ['teamBPlayersOnCourt', 'teamBOutPlayers'],
  ];
  for (const [activeField, outField] of statePairs) {
    const activePlayers = new Set(this[activeField].map((playerId) => playerId.toString()));
    if (this[outField].some((playerId) => activePlayers.has(playerId.toString()))) {
      this.invalidate(outField, 'A player cannot be both on court and out');
    }
  }
});

export default models.Match ?? model('Match', matchSchema);
