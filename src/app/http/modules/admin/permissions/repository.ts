/**
 * Permissions Repository
 * Database operations for permissions
 */

import { getPrisma } from '@core/container';

// ============================================================================
// Repository
// ============================================================================

export class PermissionsRepository {
    /**
     * Get all permissions with role info
     */
    async findAllWithRoles(): Promise<
        Array<{
            id: bigint;
            roleId: bigint;
            permissions: unknown;
            role: { id: bigint; name: string; slug: string };
        }>
    > {
        const prisma = getPrisma();
        return prisma.permission.findMany({
            include: {
                role: { select: { id: true, name: true, slug: true } }
            },
            orderBy: { roleId: 'asc' }
        });
    }
}

export default new PermissionsRepository();
