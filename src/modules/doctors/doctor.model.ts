import { Schema, model, type InferSchemaType } from 'mongoose';
import { SPECIALIZATIONS } from '../../constants/domain.js';

const doctorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    specialization: { type: String, required: true, enum: SPECIALIZATIONS },
    hospital: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
  },
  { timestamps: true },
);

// Each index maps to a real query in doctor.service / dashboard.service.
// `email` unique index is declared on the field above.
doctorSchema.index({ createdAt: -1, _id: -1 }); // default list sort + creation-date range filter
doctorSchema.index({ specialization: 1, createdAt: -1, _id: -1 }); // specialization filter, newest first
doctorSchema.index({ name: 1 }); // alphabetical sort + /doctors/options
doctorSchema.index({ hospital: 1 }); // hospital filter + distinct('hospital')

export type DoctorDoc = InferSchemaType<typeof doctorSchema>;
export const Doctor = model('Doctor', doctorSchema);
