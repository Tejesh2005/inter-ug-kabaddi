import mongoose from 'mongoose';
import { nonNegativeInteger } from './validators.js';

const { Schema } = mongoose;

export const raidStatsSchema = new Schema(
  {
    totalRaids: nonNegativeInteger,
    successfulRaids: nonNegativeInteger,
    unsuccessfulRaids: nonNegativeInteger,
    emptyRaids: nonNegativeInteger,
    raidPoints: nonNegativeInteger,
    touchPoints: nonNegativeInteger,
    bonusPoints: nonNegativeInteger,
    superRaids: nonNegativeInteger,
    doOrDieRaids: nonNegativeInteger,
    doOrDieRaidPoints: nonNegativeInteger,
  },
  { _id: false },
);

export const defenceStatsSchema = new Schema(
  {
    tacklesAttempted: nonNegativeInteger,
    successfulTackles: nonNegativeInteger,
    tacklePoints: nonNegativeInteger,
    superTackles: nonNegativeInteger,
  },
  { _id: false },
);
