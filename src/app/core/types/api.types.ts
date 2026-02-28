/**
 * API Request/Response Types
 */

export interface BaseDto {
    [key: string]: unknown;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data: T;
    statusCode: number;
    timestamp: string;
    requestId?: string;
}

export interface ApiErrorResponse {
    success: false;
    message: string;
    error_code: string;
    error: Record<string, unknown>;
    statusCode: number;
    timestamp: string;
    requestId?: string;
}
