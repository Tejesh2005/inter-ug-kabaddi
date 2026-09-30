import mongoose from 'mongoose';
import { nonNegativeInteger } from './shared/validators.js';

const { Schema, model, models } = mongoose;

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    shortName: { type: String, required: true, trim: true, uppercase: true, minlength: 2, maxlength: 12 },
    departmentOrUG: { type: String, required: true, trim: true, maxlength: 80 },
    logo: { type: String, trim: true, maxlength: 500 },
    primaryColor: { type: String, required: true, match: /^#[0-9a-f]{6}$/i },
    secondaryColor: { type: String, required: true, match: /^#[0-9a-f]{6}$/i },
    captain: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
    players: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
    matchesPlayed: nonNegativeInteger,
    wins: nonNegativeInteger,
    losses: nonNegativeInteger,
    draws: nonNegativeInteger,
    pointsFor: nonNegativeInteger,
    pointsAgainst: nonNegativeInteger,
    scoreDifference: { type: Number, default: 0 },
    leaguePoints: nonNegativeInteger,
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  },
  { timestamps: true },
);

teamSchema.index({ shortName: 1 }, { unique: true });
teamSchema.index({ status: 1, leaguePoints: -1, scoreDifference: -1 });

teamSchema.pre('validate', function validateTeamStatistics() {
  if (this.matchesPlayed !== this.wins + this.losses + this.draws) {
    this.invalidate('matchesPlayed', 'Matches played must equal wins, losses, and draws');
  }
  this.scoreDifference = this.pointsFor - this.pointsAgainst;
  if (this.captain && !this.players.some((playerId) => playerId.equals(this.captain))) {
    this.invalidate('captain', 'Captain must be included in the registered players');
  }
});

export default models.Team ?? model('Team', teamSchema);
