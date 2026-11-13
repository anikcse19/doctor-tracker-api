import type { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response.js';
import { idParamsSchema, objectIdSchema } from '../../utils/validation.js';
import { createPatientSchema, listPatientsQuerySchema } from '../patients/patient.schema.js';
import * as patientService from '../patients/patient.service.js';
import { createDoctorSchema, listDoctorsQuerySchema, updateDoctorSchema } from './doctor.schema.js';
import * as doctorService from './doctor.service.js';

export async function list(req: Request, res: Response) {
  const query = listDoctorsQuerySchema.parse(req.query);
  const { items, meta } = await doctorService.listDoctors(query);
  sendSuccess(res, items, 200, meta);
}

export async function options(_req: Request, res: Response) {
  sendSuccess(res, await doctorService.listDoctorOptions());
}

export async function hospitals(_req: Request, res: Response) {
  sendSuccess(res, await doctorService.listHospitals());
}

export async function getById(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  sendSuccess(res, await doctorService.getDoctorById(id));
}

export async function create(req: Request, res: Response) {
  const input = createDoctorSchema.parse(req.body);
  sendSuccess(res, await doctorService.createDoctor(input), 201);
}

export async function update(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const input = updateDoctorSchema.parse(req.body);
  sendSuccess(res, await doctorService.updateDoctor(id, input));
}

// ── Nested: a doctor's patients ─────────────────────────────────────────────

export async function listPatients(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const query = listPatientsQuerySchema.parse(req.query);
  await doctorService.assertDoctorExists(id);
  const { items, meta } = await patientService.listPatients({ ...query, doctor: id });
  sendSuccess(res, items, 200, meta);
}

export async function addPatient(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const input = createPatientSchema.parse(req.body);
  sendSuccess(res, await patientService.createPatientForDoctor(id, input), 201);
}

const doctorPatientParams = z.object({ id: objectIdSchema, patientId: objectIdSchema });

export async function removePatient(req: Request, res: Response) {
  const { id, patientId } = doctorPatientParams.parse(req.params);
  await patientService.deletePatient(patientId, id);
  res.status(204).end();
}
