export const SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'ENT',
  'Gastroenterology',
  'General Medicine',
  'Gynecology & Obstetrics',
  'Nephrology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Urology',
] as const;
export type Specialization = (typeof SPECIALIZATIONS)[number];

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

/** Bangladeshi mobile numbers: 01[3-9]XXXXXXXX with optional +88 / 88 country prefix. */
export const BD_PHONE_REGEX = /^(?:\+?88)?01[3-9]\d{8}$/;

/** All time-bucketed analytics are reported in the clinic's local timezone. */
export const REPORTING_TIMEZONE = 'Asia/Dhaka';
export const REPORTING_UTC_OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka has no DST
