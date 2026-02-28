// Auth module validation rules

export const sendOtpRules = {
    country_code: 'required|string|min:1|max:5',
    phone: 'required|string|min:10|max:15'
};

export const verifyOtpRules = {
    reference: 'required|string',
    code: 'required|string|digits:6',
    fcm_token: 'nullable|string',
    device: 'nullable|object',
    identifier: 'nullable|string',
    platform: 'nullable|string|in:android,ios,web'
};

export const resendOtpRules = {
    reference: 'required|string'
};

export const passwordLoginRules = {
    email: 'required|email',
    password: 'required|string|min:8',
    fcm_token: 'nullable|string',
    device: 'nullable|object',
    identifier: 'nullable|string',
    platform: 'nullable|string|in:android,ios,web'
};

export const forgotPasswordRules = {
    email: 'required|email'
};

export const resetPasswordRules = {
    token: 'required|string',
    password: 'required|string|min:8',
    password_confirmation: 'required|string|min:8'
};
