/**
 * Roles Module Validation Rules
 */

export const createRoleRules = {
    name: 'required|string|min:2|max:100',
    slug: 'required|string|min:2|max:100|regex:/^[a-z0-9_]+$/',
    for_app: 'boolean',
    password_required: 'boolean'
};

export const updateRoleRules = {
    name: 'string|min:2|max:100',
    for_app: 'boolean',
    password_required: 'boolean'
};

export const updatePermissionsRules = {
    permissions: 'required|object'
};
