import { Doctor } from '../doctors/doctor.model.js';
import { Patient } from '../patients/patient.model.js';
import { REPORTING_TIMEZONE, REPORTING_UTC_OFFSET_MS } from '../../constants/domain.js';

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;

export const TREND_RANGES = ['30', '90', '180'] as const;
type TrendUnit = 'day' | 'week';

const AGE_BUCKETS = [
  { min: 0, label: '0–17' },
  { min: 18, label: '18–29' },
  { min: 30, label: '30–44' },
  { min: 45, label: '45–59' },
  { min: 60, label: '60–74' },
  { min: 75, label: '75+' },
] as const;

interface PatientFacetResult {
  topDoctors: { doctorId: string; name: string; specialization: string; count: number }[];
  conditions: { condition: string; count: number }[];
  genders: { gender: string; count: number }[];
  ageGroups: { _id: number; count: number }[];
}

export async function getDashboardStats(rangeDays: number) {
  const now = Date.now();
  const last30Start = new Date(now - 30 * DAY_MS);
  const prev30Start = new Date(now - 60 * DAY_MS);

  const unit: TrendUnit = rangeDays > 90 ? 'week' : 'day';
  const trendStart = startOfBucket(now - (rangeDays - 1) * DAY_MS, unit);

  // Every query is independent, so they all run concurrently.
  const [
    doctorCount,
    patientCount,
    hospitals,
    growth,
    trendRaw,
    specializations,
    [patientFacets],
    recentPatients,
  ] = await Promise.all([
    // O(1) metadata counts — exact enough for headline KPIs and far cheaper than countDocuments({}).
    Doctor.estimatedDocumentCount(),
    Patient.estimatedDocumentCount(),
    Doctor.distinct('hospital'),

    // Registrations in the last 30 days vs. the 30 before (range scan on { createdAt } index).
    Patient.aggregate<{ current: number; previous: number }>([
      { $match: { createdAt: { $gte: prev30Start } } },
      {
        $group: {
          _id: null,
          current: { $sum: { $cond: [{ $gte: ['$createdAt', last30Start] }, 1, 0] } },
          previous: { $sum: { $cond: [{ $lt: ['$createdAt', last30Start] }, 1, 0] } },
        },
      },
    ]),

    // Registration trend bucketed by local (Dhaka) day or week.
    Patient.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: new Date(trendStart) } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              timezone: REPORTING_TIMEZONE,
              date: {
                $dateTrunc: {
                  date: '$createdAt',
                  unit,
                  timezone: REPORTING_TIMEZONE,
                  startOfWeek: 'monday',
                },
              },
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),

    Doctor.aggregate<{ specialization: string; count: number }>([
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $project: { _id: 0, specialization: '$_id', count: 1 } },
    ]),

    // One pass over patients produces four breakdowns (instead of four separate scans).
    Patient.aggregate<PatientFacetResult>([
      {
        $facet: {
          topDoctors: [
            { $group: { _id: '$doctor', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 8 },
            {
              $lookup: {
                from: Doctor.collection.name,
                localField: '_id',
                foreignField: '_id',
                pipeline: [{ $project: { name: 1, specialization: 1 } }],
                as: 'doctor',
              },
            },
            { $unwind: '$doctor' },
            {
              $project: {
                _id: 0,
                doctorId: '$_id',
                name: '$doctor.name',
                specialization: '$doctor.specialization',
                count: 1,
              },
            },
          ],
          conditions: [
            { $group: { _id: '$condition', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: 8 },
            { $project: { _id: 0, condition: '$_id', count: 1 } },
          ],
          genders: [
            { $group: { _id: '$gender', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $project: { _id: 0, gender: '$_id', count: 1 } },
          ],
          ageGroups: [
            {
              $bucket: {
                groupBy: {
                  $floor: { $divide: [{ $subtract: ['$$NOW', '$dateOfBirth'] }, YEAR_MS] },
                },
                boundaries: [...AGE_BUCKETS.map((bucket) => bucket.min), 200],
                default: -1,
                output: { count: { $sum: 1 } },
              },
            },
          ],
        },
      },
    ]),

    Patient.find()
      .sort({ createdAt: -1, _id: -1 })
      .limit(6)
      .select('name gender condition dateOfBirth createdAt doctor')
      .populate('doctor', 'name specialization')
      .lean(),
  ]);

  const current = growth[0]?.current ?? 0;
  const previous = growth[0]?.previous ?? 0;

  return {
    totals: {
      doctors: doctorCount,
      patients: patientCount,
      hospitals: hospitals.length,
      avgPatientsPerDoctor: doctorCount ? Math.round((patientCount / doctorCount) * 10) / 10 : 0,
    },
    newPatients: {
      last30Days: current,
      previous30Days: previous,
      // null when there's no baseline — the UI shows "new" instead of a misleading +∞%.
      changePct: previous ? Math.round(((current - previous) / previous) * 1000) / 10 : null,
    },
    trend: {
      rangeDays,
      unit,
      points: fillTrendGaps(trendRaw, trendStart, now, unit),
    },
    specializations,
    topDoctors: patientFacets?.topDoctors ?? [],
    conditions: patientFacets?.conditions ?? [],
    genders: patientFacets?.genders ?? [],
    ageGroups: AGE_BUCKETS.map((bucket) => ({
      label: bucket.label,
      count: patientFacets?.ageGroups.find((group) => group._id === bucket.min)?.count ?? 0,
    })),
    recentPatients,
  };
}

// ── Time-bucket helpers (Asia/Dhaka, fixed UTC+6, no DST) ───────────────────

function localDateKey(utcMs: number): string {
  return new Date(utcMs + REPORTING_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant of the local midnight that starts the day/week containing `utcMs`. */
function startOfBucket(utcMs: number, unit: TrendUnit): number {
  const local = utcMs + REPORTING_UTC_OFFSET_MS;
  const localDayStart = local - (local % DAY_MS);
  const daysSinceMonday = unit === 'week' ? (new Date(localDayStart).getUTCDay() + 6) % 7 : 0;
  return localDayStart - daysSinceMonday * DAY_MS - REPORTING_UTC_OFFSET_MS;
}

/** Emits a point for every bucket in range, so days/weeks with no registrations show as 0. */
function fillTrendGaps(
  raw: { _id: string; count: number }[],
  startMs: number,
  endMs: number,
  unit: TrendUnit,
) {
  const counts = new Map(raw.map((row) => [row._id, row.count]));
  const step = unit === 'week' ? 7 * DAY_MS : DAY_MS;
  const points: { date: string; count: number }[] = [];
  for (let t = startMs; t <= endMs; t += step) {
    const key = localDateKey(t);
    points.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return points;
}
