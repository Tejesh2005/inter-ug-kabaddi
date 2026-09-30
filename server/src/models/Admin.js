import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

const adminSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['SUPER_ADMIN', 'SCORER'], required: true, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_document, value) => {
        delete value.passwordHash;
        return value;
      },
    },
  },
);

adminSchema.index({ email: 1 }, { unique: true });

export default models.Admin ?? model('Admin', adminSchema);
