/**
 * Config Module Validation Rules
 */

export const createConfigRules = {
    key: 'required|string|min:3|max:255',
    value: 'required|string',
    type: 'required|string|in:string,number,boolean,json',
    description: 'string|max:500'
};

export const updateConfigRules = {
    value: 'required|string',
    description: 'string|max:500'
};
