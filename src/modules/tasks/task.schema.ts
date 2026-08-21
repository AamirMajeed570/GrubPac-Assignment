import { z } from 'zod';

const statusEnum = z.enum(['todo', 'in_progress', 'review', 'done']);
const priorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(5000).optional(),
    status: statusEnum.optional(),
    priority: priorityEnum.optional(),
    dueDate: z.string().datetime().optional(),
  }),
});

export const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).nullable().optional(),
    status: statusEnum.optional(),
    priority: priorityEnum.optional(),
    dueDate: z.string().datetime().nullable().optional(),
  }),
});

export const taskFiltersSchema = z.object({
  query: z.object({
    status: statusEnum.optional(),
    priority: priorityEnum.optional(),
    assigneeId: z.string().uuid().optional(),
    dueDateFrom: z.string().datetime().optional(),
    dueDateTo: z.string().datetime().optional(),
    search: z.string().max(200).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const assignUserSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
  }),
});

export const bulkUpdateStatusSchema = z.object({
  body: z.object({
    taskIds: z.array(z.string().uuid()).min(1).max(100),
    status: statusEnum,
  }),
});
