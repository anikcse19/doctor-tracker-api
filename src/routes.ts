import { Router } from 'express';
import { authenticate } from './middleware/authenticate.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { doctorRouter } from './modules/doctors/doctor.routes.js';
import { patientRouter } from './modules/patients/patient.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';

export const apiRouter = Router();

// Responses contain patient health data — never let browsers or proxies cache them.
apiRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

apiRouter.use('/auth', authRouter);

// Everything below requires an authenticated admin.
apiRouter.use('/doctors', authenticate, doctorRouter);
apiRouter.use('/patients', authenticate, patientRouter);
apiRouter.use('/dashboard', authenticate, dashboardRouter);
