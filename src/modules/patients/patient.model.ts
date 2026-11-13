import { Schema, model, type InferSchemaType } from 'mongoose';
import { GENDERS } from '../../constants/domain.js';

const patientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Date of birth (not age) is stored so age never goes stale; age is derived on read.
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, required: true, enum: GENDERS },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    condition: { type: String, required: true, trim: true, maxlength: 100 },
    notes: { type: String, trim: true, maxlength: 1000 },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true },
  },
  { timestamps: true },
);

// Each index maps to a real query in patient.service / doctor.service / dashboard.service.
patientSchema.index({ doctor: 1, createdAt: -1, _id: -1 }); // doctor's patient list + per-doctor counts ($lookup)
patientSchema.index({ condition: 1, createdAt: -1, _id: -1 }); // condition filter + distinct('condition')
patientSchema.index({ createdAt: -1, _id: -1 }); // default sort, date-range filter, trend analytics
patientSchema.index({ name: 1 }); // alphabetical sort

export type PatientDoc = InferSchemaType<typeof patientSchema>;
export const Patient = model('Patient', patientSchema);
