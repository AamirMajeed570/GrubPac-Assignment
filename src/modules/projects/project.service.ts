import { prisma } from '../../config/database';
import { notFound } from '../../utils/errors';
import { parsePagination, toPrismaSkipTake, paginate } from '../../utils/pagination';

export class ProjectService {
  async create(orgId: string, data: { name: string; description?: string }) {
    return prisma.project.create({
      data: { organizationId: orgId, name: data.name, description: data.description },
    });
  }

  async list(orgId: string, query: { page?: unknown; limit?: unknown }) {
    const pagination = parsePagination(query);
    const { skip, take } = toPrismaSkipTake(pagination);
    const where = { organizationId: orgId, deletedAt: null };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.project.count({ where }),
    ]);

    return paginate(projects, total, pagination);
  }

  async getById(orgId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, deletedAt: null },
    });
    if (!project) throw notFound('Project', projectId);
    return project;
  }

  async update(orgId: string, projectId: string, data: { name?: string; description?: string | null }) {
    await this.getById(orgId, projectId);
    return prisma.project.update({ where: { id: projectId }, data });
  }

  async delete(orgId: string, projectId: string) {
    await this.getById(orgId, projectId);
    return prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } });
  }

  async getDashboard(orgId: string, projectId: string) {
    await this.getById(orgId, projectId);

    const counts = await prisma.task.groupBy({
      by: ['status'],
      where: { projectId, deletedAt: null },
      _count: { status: true },
    });

    const result: Record<string, number> = { todo: 0, in_progress: 0, review: 0, done: 0 };
    for (const row of counts) {
      result[row.status] = row._count.status;
    }

    return { projectId, taskCounts: result };
  }
}

export const projectService = new ProjectService();
