/**
 * Roles Repository
 * Database operations for roles management
 */

import { getPrisma } from '@core/container';
import type { RoleEntity, RoleWithPermissionsEntity } from './types';

// ============================================================================
// Repository
// ============================================================================

export class RolesRepository {
    async findAll(): Promise<RoleEntity[]> {
        const prisma = getPrisma();
        return prisma.role.findMany({
            orderBy: { id: 'asc' }
        }) as Promise<RoleEntity[]>;
    }

    async findById(id: bigint): Promise<RoleWithPermissionsEntity | null> {
        const prisma = getPrisma();
        return prisma.role.findUnique({
            where: { id },
            include: {
                permission: { select: { id: true, permissions: true } }
            }
        }) as Promise<RoleWithPermissionsEntity | null>;
    }

    async create(data: {
        name: string;
        slug: string;
        forApp?: boolean;
        passwordRequired?: boolean;
    }): Promise<RoleEntity> {
        const prisma = getPrisma();
        return prisma.role.create({
            data: {
                name: data.name,
                slug: data.slug,
                forApp: data.forApp ?? true,
                passwordRequired: data.passwordRequired ?? false
            }
        }) as Promise<RoleEntity>;
    }

    async update(
        id: bigint,
        data: {
            name?: string;
            forApp?: boolean;
            passwordRequired?: boolean;
        }
    ): Promise<RoleEntity> {
        const prisma = getPrisma();
        return prisma.role.update({
            where: { id },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.forApp !== undefined && { forApp: data.forApp }),
                ...(data.passwordRequired !== undefined && { passwordRequired: data.passwordRequired })
            }
        }) as Promise<RoleEntity>;
    }

    async delete(id: bigint): Promise<void> {
        const prisma = getPrisma();
        await prisma.permission.deleteMany({ where: { roleId: id } });
        await prisma.role.delete({ where: { id } });
    }

    async slugExists(slug: string, excludeId?: bigint): Promise<boolean> {
        const prisma = getPrisma();
        const count = await prisma.role.count({
            where: {
                slug,
                ...(excludeId && { id: { not: excludeId } })
            }
        });
        return count > 0;
    }

    async hasUsers(id: bigint): Promise<boolean> {
        const prisma = getPrisma();
        const count = await prisma.user.count({
            where: { roleId: id }
        });
        return count > 0;
    }

    async upsertPermissions(roleId: bigint, permissions: Record<string, unknown>): Promise<void> {
        const prisma = getPrisma();
        await prisma.permission.upsert({
            where: { roleId },
            update: { permissions: permissions as object },
            create: { roleId, permissions: permissions as object }
        });
    }
}

export default new RolesRepository();
