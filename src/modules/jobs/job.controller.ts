import { Request, Response, NextFunction } from 'express';
import { jobService } from './job.service';

export class JobController {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const job = await jobService.getJobById(id!);
      res.json(job);
    } catch (err) {
      next(err);
    }
  }
}

export const jobController = new JobController();
