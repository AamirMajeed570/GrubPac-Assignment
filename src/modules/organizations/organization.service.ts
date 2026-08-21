import { prisma } from '../../config/database';
import { notFound, forbidden } from '../../utils/errors';

export class OrganizationService {
  /**
   * Get the authenticated user's organization details + member list.
   * org_id comes from the JWT — never from client input.
   */
  async getMyOrganization(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, createdAt: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!org) throw notFound('Organization', orgId);
    return org;
  }

  /**
   * List all members of the authenticated user's org.
   */
  async listMembers(orgId: string) {
    const members = await prisma.orgMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return members;
  }

  /**
   * Remove a member from the org (org_admin only).
   * Cannot remove yourself if you're the last admin.
   */
  async removeMember(orgId: string, targetUserId: string, requestingUserId: string) {
    const membership = await prisma.orgMember.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    if (!membership) throw notFound('Member', targetUserId);

    // Prevent self-removal if last admin
    if (targetUserId === requestingUserId) {
      const adminCount = await prisma.orgMember.count({
        where: { organizationId: orgId, role: 'org_admin' },
      });
      if (adminCount <= 1) {
        throw forbidden('Cannot remove yourself as the last org admin');
      }
    }

    await prisma.orgMember.delete({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
  }

  /**
   * Update a member's role (org_admin only).
   */
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
