import { prisma } from '../../config/database';
import { notFound, forbidden } from '../../utils/errors';
import { parsePagination, toPrismaSkipTake, paginate } from '../../utils/pagination';

export class ProjectService {
  /**
   * Create a project in the authenticated user's org.
   * org_id comes from JWT — never from client input.
   */
  async create(orgId: string, data: { name: string; description?: string }) {
    return prisma.project.create({
      data: {
        organizationId: orgId,
        name: data.name,
        description: data.description,
      },
    });
  }

  /**
   * List all (non-deleted) projects in the org.
   */
  async list(orgId: string, query: { page?: unknown; limit?: unknown }) {
    const pagination = parsePagination(query);
    const { skip, take } = toPrismaSkipTake(pagination);

    const where = { organizationId: orgId, deletedAt: null };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where }),
    ]);

    return paginate(projects, total, pagination);
  }

  /**
   * Get a single project — must belong to the authenticated org.
   * This is the core multi-tenant guard: we always scope by orgId.
   */
  async getById(orgId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId, deletedAt: null },
    });
    if (!project) throw notFound('Project', projectId);
    return project;
  }

  /**
   * Update a project — must belong to the authenticated org.
   */
  async update(
    orgId: string,
    projectId: string,
    data: { name?: string; description?: string | null }
  ) {
    // Verify ownership first (throws 404 if not found in this org)
    await this.getById(orgId, projectId);

    return prisma.project.update({
      where: { id: projectId },
      data,
    });
  }

  /**
   * Soft-delete a project (org_admin only — enforced at route level).
   * Sets deleted_at instead of actually deleting.
   */
  async delete(orgId: string, projectId: string) {
    await this.getById(orgId, projectId);

    return prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Project dashboard: task counts grouped by status.
   */
  async getDashboard(orgId: string, projectId: string) {
    await this.getById(orgId, projectId);

    const counts = await prisma.task.groupBy({
      by: ['status'],
      where: { projectId, deletedAt: null },
      _count: { status: true },
    });

    // Build a complete map with zeros for missing statuses
    const result: Record<string, number> = {
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };

    for (const row of counts) {
      result[row.status] = row._count.status;
    }

    return { projectId, taskCounts: result };
  }
}

export const projectService = new ProjectService();
