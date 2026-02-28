/**
 * Storage Service
 * Unified file storage using express-storage with support for multiple S3 buckets
 */

import { StorageManager } from 'express-storage';
import environment from '@config/environment.config';
import { createLogger } from '@services/logger.service';
import {
    STORAGE_BUCKETS,
    StorageBucket,
    FILE_CATEGORIES,
    FileCategory,
    UploadInitRequest,
    UploadInitResponse,
    UploadConfirmRequest,
    StorageConfirmResponse,
    ViewUrlResponse
} from './types';

const logger = createLogger('storage');

// Storage manager instances cache (keyed by bucket type)
const storageInstances = new Map<StorageBucket, StorageManager>();

// Bucket name mapping
const BUCKET_NAMES: Record<StorageBucket, string> = {
    [STORAGE_BUCKETS.DOCUMENTS]: environment.aws.s3Bucket,
    [STORAGE_BUCKETS.PUBLIC]: environment.aws.s3BucketPublic
};

/**
 * Get or create storage manager for the specified bucket (lazy singleton per bucket)
 */
const getStorageManager = (bucket: StorageBucket): StorageManager => {
    const existing = storageInstances.get(bucket);
    if (existing) return existing;

    const bucketName = BUCKET_NAMES[bucket];
    const storage = new StorageManager({
        driver: 's3-presigned',
        credentials: {
            bucketName,
            awsRegion: environment.aws.region,
            awsAccessKey: environment.aws.accessKeyId,
            awsSecretKey: environment.aws.secretAccessKey
        },
        logger: {
            debug: (msg: string) => logger.debug(msg),
            info: (msg: string) => logger.info(msg),
            warn: (msg: string) => logger.warn(msg),
            error: (msg: string) => logger.error(msg)
        }
    });

    storageInstances.set(bucket, storage);
    logger.info('Storage manager initialized', { bucket: bucketName, type: bucket });

    return storage;
};

/**
 * Determine file category from MIME type
 */
export const getFileCategory = (mimeType: string): FileCategory | null => {
    const normalizedMime = mimeType.toLowerCase();
    for (const [category, config] of Object.entries(FILE_CATEGORIES)) {
        if (config.mimeTypes.includes(normalizedMime)) {
            return category as FileCategory;
        }
    }
    return null;
};

/**
 * Validate file against category constraints
 */
export const validateFile = (
    mimeType: string,
    fileSize: number,
    category?: FileCategory
): { valid: boolean; error?: string } => {
    const detectedCategory = category ?? getFileCategory(mimeType);

    if (!detectedCategory) {
        return {
            valid: false,
            error: `Unsupported file type: ${mimeType}`
        };
    }

    const config = FILE_CATEGORIES[detectedCategory];
    if (!config) {
        return {
            valid: false,
            error: `Unknown file category: ${detectedCategory}`
        };
    }

    if (!config.mimeTypes.includes(mimeType.toLowerCase())) {
        return {
            valid: false,
            error: `Invalid MIME type for ${detectedCategory}: ${mimeType}`
        };
    }

    if (fileSize > config.maxSize) {
        const maxSizeMB = Math.round(config.maxSize / 1024 / 1024);
        return {
            valid: false,
            error: `File size exceeds ${maxSizeMB}MB limit for ${detectedCategory}`
        };
    }

    return { valid: true };
};

/**
 * Generate presigned upload URL
 */
export const generateUploadUrl = async (request: UploadInitRequest): Promise<UploadInitResponse> => {
    const bucket = request.bucket ?? STORAGE_BUCKETS.DOCUMENTS;
    const storage = getStorageManager(bucket);

    // Validate file
    const validation = validateFile(request.contentType, request.fileSize);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Build folder path
    const folder = request.folder ?? 'uploads';

    logger.debug('Generating upload URL', {
        fileName: request.fileName,
        contentType: request.contentType,
        fileSize: request.fileSize,
        bucket,
        folder
    });

    const result = await storage.generateUploadUrl(request.fileName, request.contentType, request.fileSize, folder);

    if (!result.success) {
        logger.error('Failed to generate upload URL', { error: result.error });
        throw new Error(result.error ?? 'Failed to generate upload URL');
    }
    if (!result.uploadUrl || !result.reference) {
        throw new Error('Storage provider returned incomplete upload URL response');
    }

    return {
        reference: result.reference,
        uploadUrl: result.uploadUrl,
        bucket,
        path: result.reference, // express-storage uses reference as the path
        expiresIn: 600 // 10 minutes (default presigned URL expiry)
    };
};

/**
 * Validate and confirm upload completion
 */
export const confirmUpload = async (
    request: UploadConfirmRequest,
    bucket: StorageBucket
): Promise<StorageConfirmResponse> => {
    const storage = getStorageManager(bucket);

    logger.debug('Confirming upload', {
        reference: request.reference,
        bucket
    });

    const options: Record<string, string | number> = {};
    if (request.expectedContentType != null) {
        options['expectedContentType'] = request.expectedContentType;
    }
    if (request.expectedFileSize != null) {
        options['expectedFileSize'] = request.expectedFileSize;
    }

    const result = await storage.validateAndConfirmUpload(request.reference, options);

    if (!result.success) {
        logger.warn('Upload confirmation failed', {
            reference: request.reference,
            error: result.error
        });
        return {
            success: false,
            error: result.error ?? 'Upload confirmation failed'
        };
    }

    const response: StorageConfirmResponse = {
        success: true,
        viewUrl: result.viewUrl ?? ''
    };
    if (result.actualFileSize != null) {
        response.actualFileSize = result.actualFileSize;
    }
    return response;
};

/**
 * Generate public URL for public bucket files (no presigning needed)
 */
export const getPublicUrl = (reference: string): string => {
    const bucketName = BUCKET_NAMES[STORAGE_BUCKETS.PUBLIC];
    return `https://${bucketName}.s3.${environment.aws.region}.amazonaws.com/${reference}`;
};

/**
 * Generate view URL for existing file
 * - Public bucket: returns direct public URL (no expiry)
 * - Private bucket: returns presigned URL (expires in 10 minutes)
 */
export const generateViewUrl = async (reference: string, bucket: StorageBucket): Promise<ViewUrlResponse> => {
    // For public bucket, return direct public URL (no presigning needed)
    if (bucket === STORAGE_BUCKETS.PUBLIC) {
        return {
            viewUrl: getPublicUrl(reference),
            expiresIn: 0 // No expiry for public URLs
        };
    }

    // For private bucket, generate presigned URL
    const storage = getStorageManager(bucket);

    const result = await storage.generateViewUrl(reference);

    if (!result.success) {
        logger.error('Failed to generate view URL', {
            reference,
            error: result.error
        });
        throw new Error(result.error ?? 'Failed to generate view URL');
    }
    if (!result.viewUrl) {
        throw new Error('Storage provider returned incomplete view URL response');
    }

    return {
        viewUrl: result.viewUrl,
        expiresIn: 600 // 10 minutes
    };
};

/**
 * Delete file from storage
 */
export const deleteFile = async (reference: string, bucket: StorageBucket): Promise<boolean> => {
    const storage = getStorageManager(bucket);

    logger.debug('Deleting file', { reference, bucket });

    const result = await storage.deleteFile(reference);

    if (!result.success) {
        logger.warn('Failed to delete file', { reference, bucket, error: result.error });
    }

    return result.success;
};

// Re-export types and constants
export { STORAGE_BUCKETS, FILE_CATEGORIES };
export type { StorageBucket, FileCategory };
