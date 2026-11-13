import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response.js';
import { idParamsSchema } from '../../utils/validation.js';
import { listPatientsQuerySchema, updatePatientSchema } from './patient.schema.js';
import * as patientService from './patient.service.js';

export async function list(req: Request, res: Response) {
  const query = listPatientsQuerySchema.parse(req.query);
  const { items, meta } = await patientService.listPatients(query);
  sendSuccess(res, items, 200, meta);
}

export async function conditions(_req: Request, res: Response) {
  sendSuccess(res, await patientService.listConditions());
}

export async function getById(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  sendSuccess(res, await patientService.getPatientById(id));
}

export async function update(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  const input = updatePatientSchema.parse(req.body);
  sendSuccess(res, await patientService.updatePatient(id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = idParamsSchema.parse(req.params);
  await patientService.deletePatient(id);
  res.status(204).end();
}
