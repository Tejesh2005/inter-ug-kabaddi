import mongoose from 'mongoose';
import { hasUniqueObjectIds } from './shared/validators.js';

const { Schema, model, models } = mongoose;

const uniquePlayerList = {
  type: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  validate: [
    { validator: (values) => values.length > 0, message: '{PATH} must contain at least one player' },
    { validator: hasUniqueObjectIds, message: '{PATH} cannot contain duplicate players' },
  ],
};

const matchLineupSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    startingSeven: uniquePlayerList,
    substitutes: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
      default: [],
      validate: { validator: hasUniqueObjectIds, message: 'Substitutes cannot contain duplicate players' },
    },
    captain: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
  },
  { timestamps: true },
);

matchLineupSchema.index({ matchId: 1, teamId: 1 }, { unique: true });

matchLineupSchema.pre('validate', function validateLineup() {
  const starters = new Set(this.startingSeven.map((id) => id.toString()));
  const substitutes = new Set(this.substitutes.map((id) => id.toString()));
  if ([...starters].some((id) => substitutes.has(id))) {
    this.invalidate('substitutes', 'A player cannot be both a starter and a substitute');
  }
  if (this.captain && !starters.has(this.captain.toString()) && !substitutes.has(this.captain.toString())) {
    this.invalidate('captain', 'Captain must be selected in the match squad');
  }
});

export default models.MatchLineup ?? model('MatchLineup', matchLineupSchema);
