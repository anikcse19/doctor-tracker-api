import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta } from '../../utils/response.js';
import { buildDateRangeFilter, buildSearchFilter, buildSort } from '../../utils/query.js';
import { assertDoctorExists } from '../doctors/doctor.service.js';
import { Patient } from './patient.model.js';
import type {
  CreatePatientInput,
  ListPatientsQuery,
  UpdatePatientInput,
} from './patient.schema.js';

/** Fields of the assigned doctor that are embedded in patient responses. */
const DOCTOR_SUMMARY = 'name specialization hospital';
const LIST_PROJECTION = '-__v -notes';

export async function listPatients(query: ListPatientsQuery) {
  const { page, limit, search, condition, gender, doctor, from, to, sort } = query;

  const filter = {
    ...(doctor && { doctor: new Types.ObjectId(doctor) }),
    ...(condition && { condition }),
    ...(gender && { gender }),
    ...buildDateRangeFilter(from, to),
    ...buildSearchFilter(search, ['name', 'phone', 'email', 'condition']),
  };

  // Page and total are fetched in parallel. `populate` resolves all doctors on the page with
  // ONE `$in` query (not one query per patient), so there is no N+1 problem.
  const [items, total] = await Promise.all([
    Patient.find(filter)
      .select(LIST_PROJECTION)
      .sort(buildSort(sort))
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('doctor', DOCTOR_SUMMARY)
      .lean(),
    Patient.countDocuments(filter),
  ]);

  return { items, meta: buildPaginationMeta(page, limit, total) };
}

export async function getPatientById(id: string) {
  const patient = await Patient.findById(id)
    .select('-__v')
    .populate('doctor', `${DOCTOR_SUMMARY} phone email`)
    .lean();
  if (!patient) throw ApiError.notFound('Patient');
  return patient;
}

export async function createPatientForDoctor(doctorId: string, input: CreatePatientInput) {
  await assertDoctorExists(doctorId);
  const patient = await Patient.create({ ...input, doctor: doctorId });
  return getPatientById(patient.id);
}

export async function updatePatient(id: string, input: UpdatePatientInput) {
  if (input.doctor) await assertDoctorExists(input.doctor);

  // `null` means "clear this optional field" → $unset; everything else → $set.
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ''> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null) $unset[key] = '';
    else if (value !== undefined) $set[key] = value;
  }

  const updated = await Patient.findByIdAndUpdate(
    id,
    { $set, ...(Object.keys($unset).length > 0 && { $unset }) },
    { returnDocument: 'after', runValidators: true },
  )
    .select('-__v')
    .populate('doctor', `${DOCTOR_SUMMARY} phone email`)
    .lean();

  if (!updated) throw ApiError.notFound('Patient');
  return updated;
}

export async function deletePatient(id: string, doctorId?: string) {
  // When deleting from a doctor's page, also enforce that the patient belongs to that doctor.
  const deleted = await Patient.findOneAndDelete({
    _id: new Types.ObjectId(id),
    ...(doctorId && { doctor: new Types.ObjectId(doctorId) }),
  });
  if (!deleted) throw ApiError.notFound('Patient');
}

/** Distinct conditions for the filter dropdown — served from the { condition } index. */
export async function listConditions(): Promise<string[]> {
  const conditions: string[] = await Patient.distinct('condition');
  return conditions.sort((a, b) => a.localeCompare(b));
}
