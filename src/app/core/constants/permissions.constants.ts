/**
 * Permission Constants
 * Module-based permission system for RBAC
 */

// ============================================================================
// Permission Actions
// ============================================================================

/**
 * Standard permission actions available for each module
 */
export const PERMISSION_ACTIONS = {
    /** Create new resource (POST) */
    CREATE: 'create',
    /** View single resource (GET /:id) */
    READ: 'read',
    /** View resource list (GET /) */
    LIST: 'list',
    /** Modify existing resource (PUT/PATCH) */
    UPDATE: 'update',
    /** Remove resource (DELETE) */
    DELETE: 'delete'
} as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[keyof typeof PERMISSION_ACTIONS];

// ============================================================================
// Permission Scope
// ============================================================================

/**
 * Permission scope determines resource visibility:
 * - 'own': User can only access their own resources
 * - 'all': User can access all resources (admin-level)
 */
export const PERMISSION_SCOPES = {
    /** Access only own resources */
    OWN: 'own',
    /** Access all resources (admin) */
    ALL: 'all'
} as const;

export type PermissionScope = (typeof PERMISSION_SCOPES)[keyof typeof PERMISSION_SCOPES];

// ============================================================================
// Permission Modules
// ============================================================================

/**
 * Application modules that have permission controls
 * Add new modules here when created
 */
export const PERMISSION_MODULES = {
    /** User management */
    USERS: 'users',
    /** File uploads & gallery */
    GALLERY: 'gallery',
    /** System configuration */
    CONFIG: 'config',
    /** Roles management */
    ROLES: 'roles',
    /** Permissions management */
    PERMISSIONS: 'permissions'
} as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[keyof typeof PERMISSION_MODULES];

// ============================================================================
// Permission Types
// ============================================================================

/**
 * Permission flags for a single module
 * - Actions: create, read, list, update, delete
 * - Scope: 'own' (user's resources only) or 'all' (all resources)
 */
export interface ModulePermissions {
    create: boolean;
    read: boolean;
    list: boolean;
    update: boolean;
    delete: boolean;
    /** Resource access scope - 'own' for user's resources, 'all' for admin access */
    scope: PermissionScope;
}

/**
 * Full permissions object - all modules with their permission flags
 */
export type Permissions = {
    [K in PermissionModule]?: ModulePermissions;
};

/**
 * Permission check request for middleware
 */
export interface PermissionCheck {
    module: PermissionModule;
    action: PermissionAction | PermissionAction[];
}

// ============================================================================
// Default Permissions
// ============================================================================

/**
 * All permissions enabled for a module with 'all' scope (admin-level)
 */
export const ALL_PERMISSIONS: ModulePermissions = {
    create: true,
    read: true,
    list: true,
    update: true,
    delete: true,
    scope: 'all'
};

/**
 * Read-only permissions for a module with 'all' scope
 */
export const READ_ONLY_PERMISSIONS: ModulePermissions = {
    create: false,
    read: true,
    list: true,
    update: false,
    delete: false,
    scope: 'all'
};

/**
 * No permissions for a module
 */
export const NO_PERMISSIONS: ModulePermissions = {
    create: false,
    read: false,
    list: false,
    update: false,
    delete: false,
    scope: 'own'
};

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Get the permission scope for a module
 * Returns 'own' if module not found or scope not set (safe default)
 */
export const getPermissionScope = (permissions: Permissions | undefined, module: PermissionModule): PermissionScope => {
    if (!permissions) return 'own';
    const modulePerms = permissions[module];
    if (!modulePerms) return 'own';
    return modulePerms.scope ?? 'own';
};
