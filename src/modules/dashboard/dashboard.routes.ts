import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../../utils/response.js';
import { getDashboardStats, TREND_RANGES } from './dashboard.service.js';

const statsQuerySchema = z.object({
  range: z.enum(TREND_RANGES).default('90').transform(Number),
});

async function stats(req: Request, res: Response) {
  const { range } = statsQuerySchema.parse(req.query);
  sendSuccess(res, await getDashboardStats(range));
}

export const dashboardRouter = Router();
dashboardRouter.get('/stats', stats);
