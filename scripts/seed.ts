/**
 * Seeds the database with a demo admin and realistic doctors/patients.
 *
 *   npm run seed            → upsert admin + REPLACE all doctors and patients
 *
 * Data is deterministic (fixed faker seed) and spread over the last ~6 months so the
 * dashboard trends are meaningful. All analytics are computed from these real documents.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import { SPECIALIZATIONS, type Specialization } from '../src/constants/domain.js';
import { Admin } from '../src/modules/auth/admin.model.js';
import { Doctor } from '../src/modules/doctors/doctor.model.js';
import { Patient } from '../src/modules/patients/patient.model.js';
import { BCRYPT_COST } from '../src/modules/auth/auth.service.js';

const DOCTOR_COUNT = 42;
const PATIENT_COUNT = 640;
const HISTORY_DAYS = 180;
const DAY_MS = 86_400_000;

const FIRST_NAMES_MALE = [
  'Rahim',
  'Karim',
  'Tanvir',
  'Imran',
  'Sabbir',
  'Arif',
  'Fahim',
  'Nayeem',
  'Shakil',
  'Rakib',
  'Mahmud',
  'Hasan',
  'Rafiq',
  'Jubayer',
  'Sajid',
  'Tareq',
  'Mehedi',
  'Anik',
  'Shuvo',
  'Ashik',
  'Rezaul',
  'Kamrul',
  'Mizanur',
  'Habib',
  'Zahid',
  'Faisal',
  'Nafis',
  'Rashed',
  'Sohel',
  'Biplob',
];
const FIRST_NAMES_FEMALE = [
  'Fatema',
  'Nusrat',
  'Sadia',
  'Tasnim',
  'Farhana',
  'Sharmin',
  'Ayesha',
  'Rumana',
  'Nadia',
  'Sumaiya',
  'Jannat',
  'Mahfuza',
  'Shirin',
  'Tahmina',
  'Lamia',
  'Anika',
  'Rifat',
  'Sabrina',
  'Mitu',
  'Nasrin',
  'Rokeya',
  'Shampa',
  'Moushumi',
  'Tania',
  'Afsana',
  'Priya',
  'Dilruba',
  'Sanjida',
  'Munira',
  'Israt',
];
const LAST_NAMES = [
  'Rahman',
  'Hossain',
  'Ahmed',
  'Islam',
  'Chowdhury',
  'Khan',
  'Uddin',
  'Akter',
  'Begum',
  'Sarker',
  'Haque',
  'Miah',
  'Talukder',
  'Mollah',
  'Siddique',
  'Alam',
  'Kabir',
  'Karim',
  'Bhuiyan',
  'Das',
  'Roy',
  'Saha',
  'Paul',
  'Barua',
  'Majumder',
  'Sheikh',
  'Bhattacharjee',
  'Hasan',
  'Sultana',
  'Nahar',
];
const HOSPITALS = [
  'Dhanmondi General Hospital',
  'Gulshan Medical Centre',
  'Uttara Specialized Hospital',
  'Mirpur Heart Institute',
  'Banani Women & Child Hospital',
  'Mohakhali Diagnostic & Hospital',
  'Chattogram City Hospital',
  'Sylhet Care Hospital',
  'Rajshahi Medical Centre',
  'Khulna Community Hospital',
];

const CONDITIONS: Record<Specialization, string[]> = {
  Cardiology: ['Hypertension', 'Coronary artery disease', 'Arrhythmia', 'Heart failure'],
  Dermatology: ['Eczema', 'Psoriasis', 'Acne', 'Fungal skin infection'],
  Endocrinology: ['Type 2 diabetes', 'Hypothyroidism', 'Hyperthyroidism', 'PCOS'],
  ENT: ['Chronic sinusitis', 'Tonsillitis', 'Otitis media', 'Allergic rhinitis'],
  Gastroenterology: ['Peptic ulcer', 'IBS', 'Fatty liver disease', 'GERD'],
  'General Medicine': ['Dengue fever', 'Typhoid', 'Viral fever', 'Hypertension', 'Type 2 diabetes'],
  'Gynecology & Obstetrics': ['Pregnancy care', 'PCOS', 'Anemia', 'Endometriosis'],
  Nephrology: ['Chronic kidney disease', 'Kidney stones', 'Urinary tract infection'],
  Neurology: ['Migraine', 'Epilepsy', 'Stroke recovery', 'Peripheral neuropathy'],
  Oncology: ['Breast cancer', 'Lung cancer', 'Cervical cancer', 'Leukemia'],
  Ophthalmology: ['Cataract', 'Glaucoma', 'Diabetic retinopathy', 'Conjunctivitis'],
  Orthopedics: ['Osteoarthritis', 'Lower back pain', 'Fracture follow-up', 'Osteoporosis'],
  Pediatrics: ['Pneumonia', 'Diarrhea', 'Asthma', 'Malnutrition'],
  Psychiatry: ['Depression', 'Anxiety disorder', 'Insomnia', 'Bipolar disorder'],
  Pulmonology: ['Asthma', 'COPD', 'Tuberculosis', 'Pneumonia'],
  Urology: ['Kidney stones', 'Urinary tract infection', 'Prostate enlargement'],
};

// Ages skew by specialization so the age-distribution chart is realistic.
const AGE_RANGE: Partial<Record<Specialization, [number, number]>> = {
  Pediatrics: [0, 15],
  'Gynecology & Obstetrics': [19, 45],
  Cardiology: [38, 82],
  Oncology: [30, 78],
  Ophthalmology: [25, 85],
  Orthopedics: [25, 80],
};

const pick = <T>(items: readonly T[]): T => faker.helpers.arrayElement(items);
const bdPhone = () => `01${faker.number.int({ min: 3, max: 9 })}${faker.string.numeric(8)}`;
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.|\.$/g, '');

/** Days ago, skewed toward the recent past so the registration trend shows growth. */
const recentSkewedDaysAgo = (maxDays: number) => maxDays * (1 - Math.sqrt(faker.number.float()));

async function main() {
  const { MONGODB_URI, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
  if (!MONGODB_URI || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    throw new Error('MONGODB_URI, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set');
  }
  if (SEED_ADMIN_PASSWORD.length < 8) throw new Error('SEED_ADMIN_PASSWORD must be ≥ 8 chars');

  faker.seed(20261113);
  await mongoose.connect(MONGODB_URI);
  console.warn(`Connected to "${mongoose.connection.name}"`);

  await Promise.all([Admin.syncIndexes(), Doctor.syncIndexes(), Patient.syncIndexes()]);

  // ── Admin (upsert — re-running the seed resets the password to the env value) ──
  await Admin.findOneAndUpdate(
    { email: SEED_ADMIN_EMAIL.toLowerCase() },
    {
      name: 'Care Guide Admin',
      email: SEED_ADMIN_EMAIL.toLowerCase(),
      passwordHash: await bcrypt.hash(SEED_ADMIN_PASSWORD, BCRYPT_COST),
      role: 'admin',
    },
    { upsert: true },
  );

  // ── Doctors ──
  await Promise.all([Doctor.deleteMany({}), Patient.deleteMany({})]);
  const now = Date.now();
  const usedEmails = new Set<string>();

  const doctors = Array.from({ length: DOCTOR_COUNT }, (_, index) => {
    const isFemale = faker.datatype.boolean();
    const first = pick(isFemale ? FIRST_NAMES_FEMALE : FIRST_NAMES_MALE);
    const last = pick(LAST_NAMES);
    let email = `${slug(first)}.${slug(last)}@caredoc.com.bd`;
    for (let n = 2; usedEmails.has(email); n++)
      email = `${slug(first)}.${slug(last)}${n}@caredoc.com.bd`;
    usedEmails.add(email);

    // Cover every specialization at least once, then distribute the rest randomly.
    const specialization =
      index < SPECIALIZATIONS.length ? SPECIALIZATIONS[index]! : pick(SPECIALIZATIONS);
    // Most doctors joined before the patient history window; a handful joined recently.
    const daysAgo =
      index < 36 ? faker.number.int({ min: 185, max: 300 }) : faker.number.int({ min: 2, max: 40 });
    const createdAt = new Date(now - daysAgo * DAY_MS - faker.number.int({ min: 0, max: DAY_MS }));

    return new Doctor({
      name: `Dr. ${first} ${last}`,
      specialization,
      hospital: pick(HOSPITALS),
      phone: bdPhone(),
      email,
      createdAt,
      updatedAt: createdAt,
    });
  });

  await Promise.all(doctors.map((doctor) => doctor.validate()));
  await Doctor.collection.insertMany(doctors.map((doctor) => doctor.toObject()));

  // ── Patients ──
  // Uneven popularity so "patients per doctor" has a real distribution.
  const weightedDoctors = doctors.map((doctor) => ({
    value: doctor,
    weight: faker.number.float({ min: 0.3, max: 3 }),
  }));

  const patients = Array.from({ length: PATIENT_COUNT }, () => {
    const doctor = faker.helpers.weightedArrayElement(weightedDoctors);
    const specialization = doctor.specialization as Specialization;
    const doctorAgeDays = (now - doctor.createdAt.getTime()) / DAY_MS;
    const daysAgo = recentSkewedDaysAgo(Math.min(HISTORY_DAYS, doctorAgeDays));
    const createdAt = new Date(now - daysAgo * DAY_MS);

    const gender =
      specialization === 'Gynecology & Obstetrics'
        ? 'female'
        : faker.helpers.weightedArrayElement([
            { value: 'male', weight: 48 },
            { value: 'female', weight: 50 },
            { value: 'other', weight: 2 },
          ]);
    const firstNames =
      gender === 'female'
        ? FIRST_NAMES_FEMALE
        : gender === 'male'
          ? FIRST_NAMES_MALE
          : [...FIRST_NAMES_MALE, ...FIRST_NAMES_FEMALE];
    const [minAge, maxAge] = AGE_RANGE[specialization] ?? [18, 75];
    const first = pick(firstNames);
    const last = pick(LAST_NAMES);

    return new Patient({
      name: `${first} ${last}`,
      dateOfBirth: faker.date.birthdate({ mode: 'age', min: minAge, max: maxAge }),
      gender,
      phone: bdPhone(),
      email: faker.datatype.boolean({ probability: 0.6 })
        ? `${slug(first)}.${slug(last)}${faker.number.int({ min: 1, max: 999 })}@gmail.com`
        : undefined,
      condition: pick(CONDITIONS[specialization]),
      notes: faker.datatype.boolean({ probability: 0.3 })
        ? pick([
            'Follow-up in 2 weeks.',
            'Advised lifestyle modification and regular exercise.',
            'Medication adjusted; monitor blood pressure daily.',
            'Referred for further diagnostic tests.',
            'Responding well to treatment.',
          ])
        : undefined,
      doctor: doctor._id,
      createdAt,
      updatedAt: createdAt,
    });
  });

  await Promise.all(patients.map((patient) => patient.validate()));
  await Patient.collection.insertMany(patients.map((patient) => patient.toObject()));

  console.warn(
    `✅ Seeded 1 admin (${SEED_ADMIN_EMAIL}), ${doctors.length} doctors, ${patients.length} patients`,
  );
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
