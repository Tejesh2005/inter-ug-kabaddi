import mongoose from 'mongoose';
import { defenceStatsSchema, raidStatsSchema } from './shared/statSchemas.js';
import { nonNegativeInteger } from './shared/validators.js';

const { Schema, model, models } = mongoose;

const playerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    jerseyNumber: { type: Number, required: true, min: 0, max: 999, validate: Number.isInteger },
    photo: { type: String, trim: true, maxlength: 500 },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    role: { type: String, enum: ['Raider', 'Defender', 'All-Rounder'], required: true },
    optionalPosition: {
      type: String,
      enum: ['Left Corner', 'Right Corner', 'Left Cover', 'Right Cover', 'Left In', 'Right In', 'Centre'],
      default: undefined,
    },
    isCaptain: { type: Boolean, default: false },
    isViceCaptain: { type: Boolean, default: false },
    matchesPlayed: nonNegativeInteger,
    raidStats: { type: raidStatsSchema, default: () => ({}) },
    defenceStats: { type: defenceStatsSchema, default: () => ({}) },
    totalPoints: nonNegativeInteger,
  },
  { timestamps: true },
);

playerSchema.index({ teamId: 1, jerseyNumber: 1 }, { unique: true });
playerSchema.index({ totalPoints: -1 });
playerSchema.index({ 'raidStats.raidPoints': -1 });
playerSchema.index({ 'defenceStats.tacklePoints': -1 });

playerSchema.pre('validate', function validateLeadership() {
  if (this.isCaptain && this.isViceCaptain) {
    this.invalidate('isViceCaptain', 'A player cannot be both captain and vice captain');
  }
  const calculatedTotal = this.raidStats.raidPoints + this.defenceStats.tacklePoints;
  if (this.totalPoints !== calculatedTotal) {
    this.invalidate('totalPoints', 'Total points must equal raid points plus tackle points');
  }
});

export default models.Player ?? model('Player', playerSchema);
