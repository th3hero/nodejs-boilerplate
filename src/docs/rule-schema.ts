const isNumericString = (value: string): boolean => /^[0-9]+$/.test(value);

const applyStringRule = (token: string, schema: Record<string, unknown>): void => {
    const [rule, rawValue] = token.split(':');
    if (!rule) {
        return;
    }

    if (rule === 'email') {
        schema['type'] = 'string';
        schema['format'] = 'email';
        return;
    }

    if ((rule === 'min' || rule === 'max') && rawValue && isNumericString(rawValue)) {
        const value = Number(rawValue);
        const type = schema['type'];

        if (type === 'string') {
            schema[rule === 'min' ? 'minLength' : 'maxLength'] = value;
            return;
        }

        schema[rule === 'min' ? 'minimum' : 'maximum'] = value;
        return;
    }

    if (rule === 'digits' && rawValue && isNumericString(rawValue)) {
        const digits = Number(rawValue);
        schema['type'] = 'string';
        schema['minLength'] = digits;
        schema['maxLength'] = digits;
        schema['pattern'] = `^[0-9]{${digits}}$`;
        return;
    }

    if (rule === 'in' && rawValue) {
        schema['enum'] = rawValue.split(',').map(entry => entry.trim()).filter(Boolean);
    }
};

const mapBaseType = (ruleToken: string): string | undefined => {
    if (ruleToken === 'string') return 'string';
    if (ruleToken === 'object') return 'object';
    if (ruleToken === 'array') return 'array';
    if (ruleToken === 'boolean') return 'boolean';
    if (ruleToken === 'numeric' || ruleToken === 'number') return 'number';
    if (ruleToken === 'integer' || ruleToken === 'int') return 'integer';
    return undefined;
};

export const rulesToOpenApiSchema = (rules: Record<string, string>): Record<string, unknown> => {
    const properties: Record<string, Record<string, unknown>> = {};
    const required: string[] = [];

    Object.entries(rules).forEach(([field, ruleSet]) => {
        const schema: Record<string, unknown> = {};
        let nullable = false;

        const tokens = ruleSet.split('|').map(token => token.trim()).filter(Boolean);
        for (const token of tokens) {
            if (token === 'required') {
                required.push(field);
                continue;
            }

            if (token === 'nullable') {
                nullable = true;
                continue;
            }

            const baseType = mapBaseType(token);
            if (baseType) {
                schema['type'] = baseType;
                if (baseType === 'object') {
                    schema['additionalProperties'] = true;
                }
                continue;
            }

            applyStringRule(token, schema);
        }

        if (!schema['type']) {
            schema['type'] = 'string';
        }

        if (nullable) {
            schema['nullable'] = true;
        }

        properties[field] = schema;
    });

    return {
        type: 'object',
        additionalProperties: false,
        properties,
        ...(required.length > 0 ? { required } : {})
    };
};
