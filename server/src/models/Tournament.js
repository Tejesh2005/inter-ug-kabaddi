import mongoose from 'mongoose';
import { requiredPositiveInteger } from './shared/validators.js';

const { Schema, model, models } = mongoose;

const rankingFields = ['leaguePoints', 'scoreDifference', 'pointsFor'];

const settingsSchema = new Schema(
  {
    matchDuration: { ...requiredPositiveInteger, default: 40 },
    halfDuration: { ...requiredPositiveInteger, default: 20 },
    raidTime: { ...requiredPositiveInteger, default: 30 },
    timeoutDuration: { ...requiredPositiveInteger, default: 60 },
    numberOfPlayersOnCourt: { ...requiredPositiveInteger, default: 7, max: 12 },
    maximumSquadSize: { ...requiredPositiveInteger, default: 12, max: 30 },
    allOutPoints: { ...requiredPositiveInteger, default: 2 },
    normalTacklePoints: { ...requiredPositiveInteger, default: 1 },
    superTacklePoints: { ...requiredPositiveInteger, default: 2 },
    superTackleThreshold: { ...requiredPositiveInteger, default: 3, max: 7 },
    superRaidMinimumPoints: { ...requiredPositiveInteger, default: 3, max: 12 },
    doOrDieAfterEmptyRaids: { ...requiredPositiveInteger, default: 2, max: 10 },
    bonusEnabled: { type: Boolean, default: true },
    superTackleEnabled: { type: Boolean, default: true },
    doOrDieEnabled: { type: Boolean, default: false },
    superRaidEnabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const pointsSystemSchema = new Schema(
  {
    winPoints: { type: Number, min: 0, default: 3 },
    drawPoints: { type: Number, min: 0, default: 1 },
    lossPoints: { type: Number, min: 0, default: 0 },
    closeLossEnabled: { type: Boolean, default: false },
    closeLossMargin: { type: Number, min: 0, default: 7 },
    closeLossPoints: { type: Number, min: 0, default: 1 },
  },
  { _id: false },
);

const standingsRulesSchema = new Schema(
  {
    primary: { type: String, enum: rankingFields, default: 'leaguePoints' },
    secondary: { type: String, enum: rankingFields, default: 'scoreDifference' },
    tertiary: { type: String, enum: rankingFields, default: 'pointsFor' },
  },
  { _id: false },
);

const tournamentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    shortName: { type: String, required: true, trim: true, uppercase: true, minlength: 2, maxlength: 24 },
    logo: { type: String, trim: true, maxlength: 500 },
    venue: { type: String, required: true, trim: true, maxlength: 160 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['upcoming', 'live', 'completed'], default: 'upcoming', index: true },
    format: { type: String, enum: ['league', 'knockout', 'league_knockout'], required: true },
    settings: { type: settingsSchema, default: () => ({}) },
    pointsSystem: { type: pointsSystemSchema, default: () => ({}) },
    standingsRules: { type: standingsRulesSchema, default: () => ({}) },
  },
  { timestamps: true },
);

tournamentSchema.index({ status: 1, startDate: 1 });
tournamentSchema.index({ name: 1, startDate: 1 }, { unique: true });

tournamentSchema.pre('validate', function validateTournament() {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be on or after the start date');
  }

  if (this.settings?.maximumSquadSize < this.settings?.numberOfPlayersOnCourt) {
    this.invalidate('settings.maximumSquadSize', 'Maximum squad size cannot be smaller than the on-court player count');
  }
  if (this.settings?.superTackleThreshold > this.settings?.numberOfPlayersOnCourt) {
    this.invalidate('settings.superTackleThreshold', 'Super tackle threshold cannot exceed the on-court player count');
  }

  const rules = this.standingsRules;
  if (rules && new Set([rules.primary, rules.secondary, rules.tertiary]).size !== 3) {
    this.invalidate('standingsRules', 'Standings ranking rules must be distinct');
  }
});

export default models.Tournament ?? model('Tournament', tournamentSchema);
