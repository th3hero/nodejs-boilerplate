/**
 * Database Seeder
 *
 * Seeds foundational data required for the application to function:
 * roles, permissions, test users, and system configs.
 *
 * Safe to run multiple times — all operations use upsert or existence checks.
 */

/* eslint-disable no-console */

import 'dotenv/config';
import { getPrismaClient } from './prisma.client';
import type { Prisma, User, ConfigValueType } from './prisma';
import {
    ALL_PERMISSIONS,
    READ_ONLY_PERMISSIONS,
    NO_PERMISSIONS,
    type ModulePermissions
} from '../app/core/constants/permissions.constants';
import { generateSalt, hashPassword } from '../app/http/services/password.service';

const prisma = getPrismaClient();

// ============================================================================
// Types
// ============================================================================

interface RoleSeed {
    id: bigint;
    name: string;
    slug: string;
    forApp: boolean;
    passwordRequired: boolean;
}

interface TestUserSeed {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    countryCode: string;
    roleId: bigint;
    verified: boolean;
    phoneVerifiedAt: Date;
    emailVerifiedAt: Date;
}

interface SystemConfigSeed {
    key: string;
    value: string;
    type: ConfigValueType;
    description: string;
}

type PermissionsMap = Record<string, ModulePermissions>;

interface RolePermissionSeed {
    roleId: bigint;
    permissions: PermissionsMap;
}

// ============================================================================
// Data: Roles
// ============================================================================

const roles: RoleSeed[] = [
    { id: 1n, name: 'Customer', slug: 'customer', forApp: true, passwordRequired: false },
    { id: 2n, name: 'Admin', slug: 'admin', forApp: false, passwordRequired: true },
    { id: 3n, name: 'Super Admin', slug: 'super_admin', forApp: false, passwordRequired: true }
];

// ============================================================================
// Data: Test Users
// ============================================================================

const testUsers: TestUserSeed[] = [
    {
        firstName: 'Test',
        lastName: 'Customer',
        email: 'customer@test.com',
        phone: '5551234567',
        countryCode: '1',
        roleId: 1n,
        verified: true,
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: new Date()
    },
    {
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@test.com',
        phone: '5551234569',
        countryCode: '1',
        roleId: 2n,
        verified: true,
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: new Date()
    },
    {
        firstName: 'Super',
        lastName: 'Admin',
        email: 'superadmin@test.com',
        phone: '5551234570',
        countryCode: '1',
        roleId: 3n,
        verified: true,
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: new Date()
    }
];

// ============================================================================
// Data: System Configs
// ============================================================================

const systemConfigs: SystemConfigSeed[] = [
    { key: 'general.timezone', value: 'UTC', type: 'string', description: 'Default timezone for the platform' },
    { key: 'general.date_format', value: 'YYYY-MM-DD', type: 'string', description: 'Date display format' },
    { key: 'general.time_format', value: '24h', type: 'string', description: 'Time display format (12h or 24h)' },

    {
        key: 'security.session_timeout_minutes',
        value: '30',
        type: 'number',
        description: 'Inactive session timeout in minutes'
    },
    {
        key: 'security.require_2fa_admin',
        value: 'true',
        type: 'boolean',
        description: 'Require 2FA for admin accounts'
    },
    { key: 'security.password_min_length', value: '8', type: 'number', description: 'Minimum password length' },
    {
        key: 'security.max_login_attempts',
        value: '5',
        type: 'number',
        description: 'Maximum failed login attempts before lockout'
    },
    {
        key: 'security.lockout_duration_minutes',
        value: '15',
        type: 'number',
        description: 'Account lockout duration in minutes'
    },

    { key: 'backup.enabled', value: 'true', type: 'boolean', description: 'Enable automatic backups' },
    {
        key: 'backup.frequency',
        value: 'daily',
        type: 'string',
        description: 'Backup frequency (daily, weekly, monthly)'
    },
    { key: 'backup.retention_days', value: '30', type: 'number', description: 'Number of days to retain backups' },

    { key: 'integration.s3.enabled', value: 'false', type: 'boolean', description: 'Enable AWS S3 file storage' },
    { key: 'integration.s3.region', value: 'us-east-1', type: 'string', description: 'AWS region for S3' },
    {
        key: 'integration.s3.max_file_size_mb',
        value: '10',
        type: 'number',
        description: 'Maximum file upload size in MB'
    }
];

// ============================================================================
// Data: Role Permissions
// ============================================================================

const SUPER_ADMIN_PERMISSIONS: PermissionsMap = {
    users: ALL_PERMISSIONS,
    gallery: ALL_PERMISSIONS,
    config: ALL_PERMISSIONS,
    roles: ALL_PERMISSIONS,
    permissions: ALL_PERMISSIONS
};

const ADMIN_PERMISSIONS: PermissionsMap = {
    users: { create: false, read: true, list: true, update: true, delete: false, scope: 'all' },
    gallery: ALL_PERMISSIONS,
    config: ALL_PERMISSIONS,
    roles: READ_ONLY_PERMISSIONS,
    permissions: READ_ONLY_PERMISSIONS
};

const CUSTOMER_PERMISSIONS: PermissionsMap = {
    users: NO_PERMISSIONS,
    gallery: { create: true, read: true, list: true, update: false, delete: true, scope: 'own' },
    config: NO_PERMISSIONS,
    roles: NO_PERMISSIONS,
    permissions: NO_PERMISSIONS
};

const rolePermissions: RolePermissionSeed[] = [
    { roleId: 1n, permissions: CUSTOMER_PERMISSIONS },
    { roleId: 2n, permissions: ADMIN_PERMISSIONS },
    { roleId: 3n, permissions: SUPER_ADMIN_PERMISSIONS }
];

// ============================================================================
// Seed Functions
// ============================================================================

async function seedRoles(): Promise<void> {
    console.log('Seeding roles...');

    for (const role of roles) {
        await prisma.role.upsert({
            where: { id: role.id },
            update: {
                name: role.name,
                slug: role.slug,
                forApp: role.forApp,
                passwordRequired: role.passwordRequired
            },
            create: {
                id: role.id,
                name: role.name,
                slug: role.slug,
                forApp: role.forApp,
                passwordRequired: role.passwordRequired
            }
        });
    }

    console.log(`  ✓ ${roles.length} roles`);
}

async function seedPermissions(): Promise<void> {
    console.log('Seeding permissions...');

    for (const rp of rolePermissions) {
        const permData = rp.permissions as unknown as Prisma.InputJsonValue;

        await prisma.permission.upsert({
            where: { roleId: rp.roleId },
            update: { permissions: permData },
            create: { roleId: rp.roleId, permissions: permData }
        });
    }

    console.log(`  ✓ ${rolePermissions.length} role permissions`);
}

async function seedTestUsers(): Promise<void> {
    console.log('Seeding test users...');

    for (const userData of testUsers) {
        let user: User | null = await prisma.user.findFirst({
            where: { email: userData.email }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    email: userData.email,
                    phone: userData.phone,
                    countryCode: userData.countryCode,
                    role: { connect: { id: userData.roleId } },
                    verified: userData.verified,
                    phoneVerifiedAt: userData.phoneVerifiedAt,
                    emailVerifiedAt: userData.emailVerifiedAt
                }
            });
            console.log(`  ✓ Created user: ${userData.email}`);
        } else {
            console.log(`  - Exists: ${userData.email}`);
        }

        const role = roles.find(r => r.id === userData.roleId);
        if (role?.passwordRequired) {
            const hasPassword = await prisma.password.findFirst({ where: { userId: user.id } });

            if (!hasPassword) {
                const salt = generateSalt();
                await prisma.password.create({
                    data: {
                        user: { connect: { id: user.id } },
                        password: hashPassword('Admin@123', salt),
                        salt
                    }
                });
                console.log(`  ✓ Created password for: ${userData.email}`);
            }
        }
    }
}

async function seedSystemConfigs(): Promise<void> {
    console.log('Seeding system configs...');

    for (const config of systemConfigs) {
        const data = { value: config.value, type: config.type, description: config.description };

        await prisma.systemConfig.upsert({
            where: { key: config.key },
            update: data,
            create: { key: config.key, ...data }
        });
    }

    console.log(`  ✓ ${systemConfigs.length} system configs`);
}

async function resetSequences(): Promise<void> {
    console.log('Resetting sequences...');

    const tables = ['roles', 'permissions'];

    for (const table of tables) {
        try {
            await prisma.$executeRawUnsafe(
                `SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM "${table}"), 1));`
            );
        } catch {
            console.log(`  - Skipped: ${table} (no sequence)`);
        }
    }

    console.log('  ✓ Sequences reset');
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
    console.log('\n🌱 Starting database seed...\n');

    try {
        await seedRoles();
        await seedPermissions();
        await seedTestUsers();
        await seedSystemConfigs();
        await resetSequences();

        console.log('\n✅ Database seeded successfully!\n');
        console.log('Test Users (OTP login — dev OTP: 123456):');
        console.log('  Customer:     customer@test.com');
        console.log('');
        console.log('Test Users (Password login — Admin@123):');
        console.log('  Admin:        admin@test.com');
        console.log('  Super Admin:  superadmin@test.com\n');
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('\n❌ Seed failed:', message);
        throw error;
    }
}

main()
    .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
