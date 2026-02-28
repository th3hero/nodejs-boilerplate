/**
 * Gallery Module Validation Rules
 */

export const uploadInitRules = {
    fileName: 'required|string|min:1|max:255',
    contentType: 'required|string|min:3|max:100',
    fileSize: 'required|integer|min:1',
    bucket: 'string|in:documents,public',
    folder: 'string|max:255',
    isPublic: 'boolean',
    title: 'string|max:255',
    description: 'string|max:255'
};

export const uploadConfirmRules = {
    reference: 'required|string|min:1|max:255'
};
