/**
 * Gallery Service
 * Business logic for file uploads using presigned URLs
 */

import { GalleryType } from '@database/prisma';
import { createLogger } from '@services/logger.service';
import {
    generateUploadUrl as storageGenerateUploadUrl,
    confirmUpload as storageConfirmUpload,
    generateViewUrl as storageGenerateViewUrl,
    deleteFile as storageDeleteFile,
    getFileCategory,
    STORAGE_BUCKETS,
    StorageBucket
} from '@services/storage';

import repository from './repository';
import type { ViewUrlResponse } from '@services/storage/types';
import type {
    UploadInitDto,
    UploadInitResponse,
    UploadConfirmResponse,
    GalleryResponse
} from './types';
import { toGalleryResponse } from './types';

const logger = createLogger('gallery');

/**
 * Determine GalleryType from MIME type
 */
const getGalleryType = (mimeType: string): GalleryType => {
    const mime = mimeType.toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime === 'application/pdf') return 'pdf';
    return 'image'; // Default to image
};

/**
 * Extract file extension from filename
 */
const getExtension = (fileName: string): string => {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot === -1) return '';
    return fileName.substring(lastDot).toLowerCase();
};

/**
 * Initialize upload and get presigned URL
 */
export const initUpload = async (userId: bigint, dto: UploadInitDto): Promise<UploadInitResponse> => {
    const bucket = (dto.bucket ?? STORAGE_BUCKETS.DOCUMENTS) as StorageBucket;
    const isPublic = dto.isPublic ?? bucket === STORAGE_BUCKETS.PUBLIC;

    // Validate file category
    const category = getFileCategory(dto.contentType);
    if (!category) {
        throw new Error(`Unsupported file type: ${dto.contentType}`);
    }

    // Generate presigned upload URL
    const uploadResult = await storageGenerateUploadUrl({
        fileName: dto.fileName,
        contentType: dto.contentType,
        fileSize: dto.fileSize,
        bucket,
        folder: dto.folder ?? 'uploads',
        isPublic
    });

    // Create gallery record in pending state
    const gallery = await repository.create({
        uploadedById: userId,
        reference: uploadResult.reference,
        title: dto.title ?? null,
        description: dto.description ?? null,
        filetype: dto.contentType,
        extension: getExtension(dto.fileName),
        size: BigInt(dto.fileSize),
        bucket,
        isPublic,
        type: getGalleryType(dto.contentType),
        path: uploadResult.path
    });

    logger.info('Upload initialized', {
        userId: userId.toString(),
        galleryId: gallery.id.toString(),
        reference: uploadResult.reference,
        bucket,
        contentType: dto.contentType
    });

    return {
        reference: uploadResult.reference,
        uploadUrl: uploadResult.uploadUrl,
        bucket: uploadResult.bucket,
        path: uploadResult.path,
        expiresIn: uploadResult.expiresIn,
        galleryId: gallery.id.toString()
    };
};

/**
 * Confirm upload completion
 */
export const confirmUpload = async (userId: bigint, reference: string): Promise<UploadConfirmResponse> => {
    // Find gallery record
    const gallery = await repository.findByReference(reference);
    if (!gallery) {
        return {
            success: false,
            error: 'Upload reference not found'
        };
    }

    // Verify ownership
    if (gallery.uploadedById !== userId) {
        return {
            success: false,
            error: 'Not authorized to confirm this upload'
        };
    }

    // Check if already confirmed
    if (gallery.status === 'uploaded') {
        const viewUrlResult = await storageGenerateViewUrl(gallery.reference, gallery.bucket as StorageBucket);
        return {
            success: true,
            gallery: toGalleryResponse(gallery, viewUrlResult.viewUrl)
        };
    }

    // Check if failed
    if (gallery.status === 'failed') {
        return {
            success: false,
            error: 'Upload has failed or expired'
        };
    }

    // Confirm with storage service
    const confirmResult = await storageConfirmUpload(
        { reference, expectedContentType: gallery.filetype },
        gallery.bucket as StorageBucket
    );

    if (!confirmResult.success) {
        // Mark as failed in database
        await repository.updateStatus(gallery.id, 'failed');
        logger.warn('Upload confirmation failed', {
            galleryId: gallery.id.toString(),
            reference,
            error: confirmResult.error
        });
        return {
            success: false,
            error: confirmResult.error ?? 'Upload confirmation failed'
        };
    }

    // Update gallery record
    const updatedGallery = await repository.confirmUpload(gallery.id, {
        size: confirmResult.actualFileSize != null ? BigInt(confirmResult.actualFileSize) : null,
        status: 'uploaded'
    });

    logger.info('Upload confirmed', {
        galleryId: gallery.id.toString(),
        reference,
        size: confirmResult.actualFileSize
    });

    return {
        success: true,
        gallery: toGalleryResponse(updatedGallery, confirmResult.viewUrl)
    };
};

/**
 * Get gallery by ID with view URL
 */
export const getById = async (id: bigint, userId?: bigint): Promise<GalleryResponse | null> => {
    const gallery = await repository.findById(id);
    if (!gallery) return null;

    // Check ownership if userId provided (non-public file)
    if (!gallery.isPublic && userId && gallery.uploadedById !== userId) {
        return null;
    }

    // Only generate view URL for uploaded files
    let viewUrl: string | undefined;
    if (gallery.status === 'uploaded') {
        try {
            const viewUrlResult = await storageGenerateViewUrl(gallery.reference, gallery.bucket as StorageBucket);
            viewUrl = viewUrlResult.viewUrl;
        } catch (error) {
            logger.warn('Failed to generate view URL', {
                galleryId: gallery.id.toString(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    return toGalleryResponse(gallery, viewUrl);
};

/**
 * Generate view URL for existing gallery
 */
export const getViewUrl = async (id: bigint, userId?: bigint): Promise<ViewUrlResponse | null> => {
    const gallery = await repository.findById(id);
    if (!gallery) return null;

    // Check ownership if not public
    if (!gallery.isPublic && userId && gallery.uploadedById !== userId) {
        return null;
    }

    // Only for uploaded files
    if (gallery.status !== 'uploaded') {
        return null;
    }

    return storageGenerateViewUrl(gallery.reference, gallery.bucket as StorageBucket);
};

/**
 * Delete gallery and file from storage
 */
export const deleteGallery = async (id: bigint, userId: bigint): Promise<{ success: boolean; error?: string }> => {
    const gallery = await repository.findById(id);
    if (!gallery) {
        return { success: false, error: 'Gallery not found' };
    }

    // Verify ownership
    if (gallery.uploadedById !== userId) {
        return { success: false, error: 'Not authorized to delete this file' };
    }

    // Delete from storage (only if uploaded)
    if (gallery.status === 'uploaded') {
        try {
            await storageDeleteFile(gallery.reference, gallery.bucket as StorageBucket);
        } catch (error) {
            logger.warn('Failed to delete file from storage', {
                galleryId: gallery.id.toString(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            // Continue with database deletion even if storage deletion fails
        }
    }

    // Delete from database (may fail if gallery is referenced by other records)
    try {
        await repository.deleteById(id);
    } catch (error: unknown) {
        // Handle foreign key constraint violation (P2003) — gallery is still in use
        const prismaError = error as Error & { code?: string };
        if (prismaError.code === 'P2003') {
            logger.warn('Cannot delete gallery — still referenced by other records', {
                galleryId: gallery.id.toString()
            });
            return {
                success: false,
                error: 'Cannot delete file — it is still in use by another resource (e.g., avatar, document)'
            };
        }
        throw error;
    }

    logger.info('Gallery deleted', {
        galleryId: gallery.id.toString(),
        userId: userId.toString()
    });

    return { success: true };
};

/**
 * List uploads with optional owner filter
 * @param ownerId - If provided, filter to this user's uploads. If undefined, return all (admin scope)
 */
export const listUploads = async (
    ownerId: bigint | undefined,
    options?: { limit?: number; offset?: number }
): Promise<{ galleries: GalleryResponse[]; total: number }> => {
    const result = ownerId
        ? await repository.findByUserId(ownerId, { ...options, status: 'uploaded' })
        : await repository.findAll({ ...options, status: 'uploaded' });

    // Generate view URLs for all galleries
    const galleriesWithUrls = await Promise.all(
        result.galleries.map(async gallery => {
            let viewUrl: string | undefined;
            try {
                const viewUrlResult = await storageGenerateViewUrl(gallery.reference, gallery.bucket as StorageBucket);
                viewUrl = viewUrlResult.viewUrl;
            } catch {
                // Ignore errors for individual files
            }
            return toGalleryResponse(gallery, viewUrl);
        })
    );

    return {
        galleries: galleriesWithUrls,
        total: result.total
    };
};

export default {
    initUpload,
    confirmUpload,
    getById,
    getViewUrl,
    deleteGallery,
    listUploads
};
