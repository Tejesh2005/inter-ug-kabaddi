import mongoose from 'mongoose';
import { hasUniqueObjectIds, isUuid, nonNegativeInteger, requiredNonNegativeInteger, requiredPositiveInteger } from './shared/validators.js';

const { Schema, model, models } = mongoose;

const eventTypes = [
  'RAID_TOUCH', 'RAID_BONUS', 'EMPTY_RAID', 'TACKLE', 'SUPER_TACKLE', 'ALL_OUT',
  'TECHNICAL_POINT', 'SUBSTITUTION', 'TIMEOUT', 'PLAYER_OUT', 'PLAYER_REVIVED',
  'SCORE_CORRECTION', 'UNDO', 'MATCH_START', 'FIRST_HALF_END', 'SECOND_HALF_START', 'MATCH_END',
  'TIMER_START', 'TIMER_PAUSE', 'TIMER_RESUME', 'MATCH_REOPEN',
];

const eventPlayerList = {
  type: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
  default: [],
  validate: { validator: hasUniqueObjectIds, message: '{PATH} cannot contain duplicate players' },
};

const matchEventSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
    actionId: { type: String, required: true, lowercase: true, validate: { validator: isUuid, message: 'actionId must be a UUID' } },
    eventNumber: requiredPositiveInteger,
    raidNumber: requiredNonNegativeInteger,
    half: { type: String, enum: ['first', 'halftime', 'second', 'none'], required: true },
    timestamp: { type: Date, default: Date.now, required: true },
    type: { type: String, enum: eventTypes, required: true },
    raidingTeam: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    defendingTeam: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    raiderId: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
    tacklerId: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
    assistPlayers: eventPlayerList,
    touchedPlayers: eventPlayerList,
    playerOutIds: eventPlayerList,
    playerRevivedIds: eventPlayerList,
    bonusPoint: nonNegativeInteger,
    raidPoints: nonNegativeInteger,
    tacklePoints: nonNegativeInteger,
    technicalPoints: nonNegativeInteger,
    allOutPoints: nonNegativeInteger,
    isSuperRaid: { type: Boolean, default: false },
    isDoOrDie: { type: Boolean, default: false },
    teamAPointsChange: { type: Number, default: 0, validate: Number.isInteger },
    teamBPointsChange: { type: Number, default: 0, validate: Number.isInteger },
    teamAScoreAfter: requiredNonNegativeInteger,
    teamBScoreAfter: requiredNonNegativeInteger,
    description: { type: String, required: true, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    isUndone: { type: Boolean, default: false },
    undoneAt: { type: Date, default: null },
    undoneBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
    previousState: { type: Schema.Types.Mixed, required: true },
    playerStatChanges: { type: [Schema.Types.Mixed], default: [] },
    undoneEventId: { type: Schema.Types.ObjectId, ref: 'MatchEvent', default: null },
  },
  { timestamps: true, minimize: false },
);

matchEventSchema.index({ actionId: 1 }, { unique: true });
matchEventSchema.index({ matchId: 1, eventNumber: 1 }, { unique: true });
matchEventSchema.index({ matchId: 1, timestamp: -1 });
matchEventSchema.index({ matchId: 1, isUndone: 1, eventNumber: -1 });

matchEventSchema.pre('validate', function validateUndoMetadata() {
  if (this.isUndone && (!this.undoneAt || !this.undoneBy)) {
    this.invalidate('isUndone', 'Undone events require undoneAt and undoneBy');
  }
  if (this.raidingTeam?.equals(this.defendingTeam)) {
    this.invalidate('defendingTeam', 'Raiding and defending teams must be different');
  }
});

export { eventTypes };
export default models.MatchEvent ?? model('MatchEvent', matchEventSchema);
