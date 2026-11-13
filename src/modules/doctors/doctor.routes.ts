import { Router } from 'express';
import * as doctorController from './doctor.controller.js';

export const doctorRouter = Router();

doctorRouter.get('/', doctorController.list);
doctorRouter.post('/', doctorController.create);
// Static paths are registered before `/:id` so they are never captured as an id.
doctorRouter.get('/options', doctorController.options);
doctorRouter.get('/hospitals', doctorController.hospitals);
doctorRouter.get('/:id', doctorController.getById);
doctorRouter.patch('/:id', doctorController.update);

doctorRouter.get('/:id/patients', doctorController.listPatients);
doctorRouter.post('/:id/patients', doctorController.addPatient);
doctorRouter.delete('/:id/patients/:patientId', doctorController.removePatient);
