import { Types, type PipelineStage } from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta } from '../../utils/response.js';
import {
  buildDateRangeFilter,
  buildInFilter,
  buildSearchFilter,
  buildSort,
} from '../../utils/query.js';
import { Patient } from '../patients/patient.model.js';
import { Doctor } from './doctor.model.js';
import type { CreateDoctorInput, ListDoctorsQuery, UpdateDoctorInput } from './doctor.schema.js';

/**
 * Adds `patientCount` to each doctor with a single correlated $lookup.
 * The lookup is an equality match on `patients.doctor`, served by the { doctor, createdAt }
 * index, and runs only for the documents on the current page — never for the whole collection.
 */
const withPatientCount: PipelineStage[] = [
  {
    $lookup: {
      from: Patient.collection.name,
      localField: '_id',
      foreignField: 'doctor',
      pipeline: [{ $count: 'count' }],
      as: 'patientStats',
    },
  },
  { $addFields: { patientCount: { $ifNull: [{ $first: '$patientStats.count' }, 0] } } },
  { $project: { patientStats: 0, __v: 0 } },
];

export async function listDoctors(query: ListDoctorsQuery) {
  const { page, limit, search, specialization, hospital, from, to, sort } = query;

  const filter = {
    ...buildInFilter('specialization', specialization),
    ...buildInFilter('hospital', hospital),
    ...buildDateRangeFilter(from, to),
    ...buildSearchFilter(search, ['name', 'email', 'phone', 'hospital']),
  };

  // $match → $sort → $skip → $limit happen BEFORE the $lookup, so the join only touches
  // `limit` documents. Count runs in parallel against the same indexed filter.
  const [items, total] = await Promise.all([
    Doctor.aggregate([
      { $match: filter },
      { $sort: buildSort(sort) },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      ...withPatientCount,
    ]),
    Doctor.countDocuments(filter),
  ]);

  return { items, meta: buildPaginationMeta(page, limit, total) };
}

export async function getDoctorById(id: string) {
  const doctorId = new Types.ObjectId(id);

  // Profile and patient statistics are fetched concurrently; the stats are computed in a
  // single $facet pass over this doctor's patients (index: { doctor, createdAt }).
  const [doctor, [stats]] = await Promise.all([
    Doctor.findById(doctorId).select('-__v').lean(),
    Patient.aggregate<{
      total: { count: number }[];
      topConditions: { condition: string; count: number }[];
      genders: { gender: string; count: number }[];
      latest: { createdAt: Date }[];
    }>([
      { $match: { doctor: doctorId } },
      {
        $facet: {
          total: [{ $count: 'count' }],
          topConditions: [
            { $group: { _id: '$condition', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 5 },
            { $project: { _id: 0, condition: '$_id', count: 1 } },
          ],
          genders: [
            { $group: { _id: '$gender', count: { $sum: 1 } } },
            { $project: { _id: 0, gender: '$_id', count: 1 } },
          ],
          latest: [
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            { $project: { _id: 0, createdAt: 1 } },
          ],
        },
      },
    ]),
  ]);

  if (!doctor) throw ApiError.notFound('Doctor');

  return {
    ...doctor,
    stats: {
      patientCount: stats?.total[0]?.count ?? 0,
      topConditions: stats?.topConditions ?? [],
      genders: stats?.genders ?? [],
      lastPatientAt: stats?.latest[0]?.createdAt ?? null,
    },
  };
}

export async function createDoctor(input: CreateDoctorInput) {
  // Duplicate emails are rejected by the unique index → translated to 409 by the error handler.
  const doctor = await Doctor.create(input);
  const { __v: _version, ...rest } = doctor.toObject();
  return { ...rest, patientCount: 0 };
}

export async function updateDoctor(id: string, input: UpdateDoctorInput) {
  const updated = await Doctor.findByIdAndUpdate(id, input, {
    returnDocument: 'after',
    runValidators: true,
  })
    .select('-__v')
    .lean();
  if (!updated) throw ApiError.notFound('Doctor');
  return updated;
}

/** Lightweight list for select inputs (e.g. reassigning a patient). Projection keeps it small. */
export async function listDoctorOptions() {
  return Doctor.find().select('name specialization').sort({ name: 1 }).limit(1000).lean();
}

export async function listHospitals(): Promise<string[]> {
  const hospitals: string[] = await Doctor.distinct('hospital');
  return hospitals.sort((a, b) => a.localeCompare(b));
}

export async function assertDoctorExists(id: string) {
  const exists = await Doctor.exists({ _id: new Types.ObjectId(id) });
  if (!exists) throw ApiError.notFound('Doctor');
}
