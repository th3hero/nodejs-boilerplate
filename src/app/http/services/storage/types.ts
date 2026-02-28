/**
 * Storage Service Types
 * Type definitions for file storage operations
 */

/**
 * Available storage buckets
 */
export const STORAGE_BUCKETS = {
    /** Private bucket for sensitive documents (license, insurance, etc.) */
    DOCUMENTS: 'documents',
    /** Public bucket for publicly accessible files (avatars, thumbnails) */
    PUBLIC: 'public'
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/**
 * File category configuration
 */
interface FileCategoryConfig {
    mimeTypes: readonly string[];
    extensions: readonly string[];
    maxSize: number;
}

/**
 * File type categories with validation rules
 */
export const FILE_CATEGORIES: Record<string, FileCategoryConfig> = {
    IMAGE: {
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
        maxSize: 10 * 1024 * 1024 // 10MB
    },
    DOCUMENT: {
        mimeTypes: ['application/pdf'],
        extensions: ['.pdf'],
        maxSize: 25 * 1024 * 1024 // 25MB
    },
    VIDEO: {
        mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
        extensions: ['.mp4', '.webm', '.mov'],
        maxSize: 100 * 1024 * 1024 // 100MB
    }
};

export type FileCategory = 'IMAGE' | 'DOCUMENT' | 'VIDEO';

/**
 * Upload initialization request
 */
export interface UploadInitRequest {
    fileName: string;
    contentType: string;
    fileSize: number;
    bucket?: StorageBucket;
    folder: string;
    isPublic?: boolean;
}

/**
 * Upload initialization response
 */
export interface UploadInitResponse {
    reference: string;
    uploadUrl: string;
    bucket: StorageBucket;
    path: string;
    expiresIn: number;
}

/**
 * Upload confirmation request
 */
export interface UploadConfirmRequest {
    reference: string;
    expectedContentType?: string | null;
    expectedFileSize?: number | null;
}

/**
 * Storage upload confirmation response
 */
export interface StorageConfirmResponseSuccess {
    success: true;
    viewUrl: string;
    actualFileSize?: number;
}

export interface StorageConfirmResponseFailure {
    success: false;
    error: string;
}

export type StorageConfirmResponse = StorageConfirmResponseSuccess | StorageConfirmResponseFailure;

/**
 * View URL response
 */
export interface ViewUrlResponse {
    viewUrl: string;
    expiresIn: number;
}
