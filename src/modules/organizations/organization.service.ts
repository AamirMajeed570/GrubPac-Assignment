import { prisma } from '../../config/database';
import { notFound, forbidden } from '../../utils/errors';

export class OrganizationService {
  async getMyOrganization(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!org) throw notFound('Organization', orgId);
    return org;
  }

  async listMembers(orgId: string) {
    return prisma.orgMember.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async removeMember(orgId: string, targetUserId: string, requestingUserId: string) {
    const membership = await prisma.orgMember.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    if (!membership) throw notFound('Member', targetUserId);

    if (targetUserId === requestingUserId) {
      const adminCount = await prisma.orgMember.count({ where: { organizationId: orgId, role: 'org_admin' } });
      if (adminCount <= 1) throw forbidden('Cannot remove yourself as the last org admin');
    }

    await prisma.orgMember.delete({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
  }

  async updateMemberRole(orgId: string, targetUserId: string, role: 'org_admin' | 'member') {
    const membership = await prisma.orgMember.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    if (!membership) throw notFound('Member', targetUserId);

    return prisma.orgMember.update({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }
}

export const organizationService = new OrganizationService();
