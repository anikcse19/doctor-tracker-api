import { Router } from 'express';
import * as patientController from './patient.controller.js';

export const patientRouter = Router();

patientRouter.get('/', patientController.list);
patientRouter.get('/conditions', patientController.conditions);
patientRouter.get('/:id', patientController.getById);
patientRouter.patch('/:id', patientController.update);
patientRouter.delete('/:id', patientController.remove);
