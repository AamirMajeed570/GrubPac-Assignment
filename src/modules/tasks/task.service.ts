import { Prisma, TaskStatus, TaskPriority } from '@prisma/client';
import { prisma } from '../../config/database';
import { notFound, conflict, forbidden, ErrorCode } from '../../utils/errors';
import { parsePagination, toPrismaSkipTake, paginate } from '../../utils/pagination';
import { getEmailQueue } from '../../queue/queues';
import { EMAIL_JOB_NAME, EmailJobPayload } from '../../queue/jobs/email.job';
import { logger } from '../../utils/logger';

export class TaskService {
  private async verifyProject(orgId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, deletedAt: null },
    });
    if (!project) throw notFound('Project', projectId);
    return project;
  }

  private async verifyTask(orgId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null, project: { organizationId: orgId, deletedAt: null } },
    });
    if (!task) throw notFound('Task', taskId);
    return task;
  }

  async create(
    orgId: string,
    projectId: string,
    creatorId: string,
    data: { title: string; description?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string }
  ) {
    await this.verifyProject(orgId, projectId);

    return prisma.task.create({
      data: {
        projectId,
        creatorId,
        title: data.title,
        description: data.description,
        status: data.status ?? TaskStatus.todo,
        priority: data.priority ?? TaskPriority.medium,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async list(
    orgId: string,
    projectId: string,
    query: {
      status?: string;
      priority?: string;
      assigneeId?: string;
      dueDateFrom?: string;
      dueDateTo?: string;
      search?: string;
      page?: unknown;
      limit?: unknown;
    }
  ) {
    await this.verifyProject(orgId, projectId);

    const pagination = parsePagination(query);
    const { skip, take } = toPrismaSkipTake(pagination);

    const where: Prisma.TaskWhereInput = { projectId, deletedAt: null };

    if (query.status) where.status = query.status as TaskStatus;
    if (query.priority) where.priority = query.priority as TaskPriority;
    if (query.dueDateFrom || query.dueDateTo) {
      where.dueDate = {};
      if (query.dueDateFrom) where.dueDate.gte = new Date(query.dueDateFrom);
      if (query.dueDateTo) where.dueDate.lte = new Date(query.dueDateTo);
    }
    if (query.assigneeId) where.assignments = { some: { userId: query.assigneeId } };
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
          _count: { select: { comments: true } },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return paginate(tasks, total, pagination);
  }

  async getById(orgId: string, taskId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null, project: { organizationId: orgId, deletedAt: null } },
      include: {
        project: { select: { id: true, name: true, organizationId: true } },
        creator: { select: { id: true, name: true, email: true } },
        assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
        comments: {
          include: { author: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!task) throw notFound('Task', taskId);
    return task;
  }

  async update(
    orgId: string,
    taskId: string,
    data: { title?: string; description?: string | null; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null }
  ) {
    await this.verifyTask(orgId, taskId);

    return prisma.task.update({
      where: { id: taskId },
      data: {
        ...data,
        dueDate: data.dueDate === null ? null : data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async delete(orgId: string, taskId: string) {
    await this.verifyTask(orgId, taskId);
    return prisma.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } });
  }

  async assignUser(orgId: string, taskId: string, targetUserId: string, assignerUserId: string) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null, project: { organizationId: orgId, deletedAt: null } },
      include: { project: { include: { organization: true } } },
    });
    if (!task) throw notFound('Task', taskId);

    const targetMembership = await prisma.orgMember.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
      include: { user: true },
    });
    if (!targetMembership) throw forbidden('The user to be assigned does not belong to this organization');

    const existing = await prisma.taskAssignment.findUnique({
      where: { taskId_userId: { taskId, userId: targetUserId } },
    });
    if (existing) throw conflict('User is already assigned to this task', ErrorCode.DUPLICATE_ASSIGNMENT);

    const assignment = await prisma.taskAssignment.create({
      data: { taskId, userId: targetUserId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const assigner = await prisma.user.findUnique({ where: { id: assignerUserId }, select: { name: true } });

    let jobId: string | undefined;
    try {
      const emailQueue = getEmailQueue();
      const payload: EmailJobPayload = {
        type: 'TASK_ASSIGNED',
        to: targetMembership.user.email,
        assigneeName: targetMembership.user.name,
        assignerName: assigner?.name ?? 'Someone',
        taskTitle: task.title,
        taskId: task.id,
        projectName: task.project.name,
        organizationName: task.project.organization.name,
      };
      const job = await emailQueue.add(EMAIL_JOB_NAME, payload);
      jobId = job.id;
    } catch (err) {
      logger.error('Failed to enqueue email notification', { taskId, targetUserId, err });
    }

    return { assignment, jobId };
  }

  async unassignUser(orgId: string, taskId: string, targetUserId: string) {
    await this.verifyTask(orgId, taskId);

    const assignment = await prisma.taskAssignment.findUnique({
      where: { taskId_userId: { taskId, userId: targetUserId } },
    });
    if (!assignment) throw notFound('Assignment');

    await prisma.taskAssignment.delete({ where: { taskId_userId: { taskId, userId: targetUserId } } });
  }

  async bulkUpdateStatus(orgId: string, taskIds: string[], status: TaskStatus) {
    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds }, deletedAt: null, project: { organizationId: orgId, deletedAt: null } },
      select: { id: true },
    });

    const foundIds = tasks.map((t) => t.id);
    const notFoundIds = taskIds.filter((id) => !foundIds.includes(id));
    if (notFoundIds.length > 0) throw notFound('Task', notFoundIds.join(', '));

    const result = await prisma.task.updateMany({ where: { id: { in: taskIds } }, data: { status } });
    return { updated: result.count, status };
  }
}

export const taskService = new TaskService();
