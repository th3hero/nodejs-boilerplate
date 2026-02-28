/**
 * Gallery Module Types
 * Type definitions for file upload operations
 */

import type { Gallery, GalleryStatus, GalleryType } from '@database/prisma';
import type { StorageBucket } from '@services/storage';

// ============================================================================
// DTOs
// ============================================================================

/**
 * Request to initialize a presigned upload
 */
export interface UploadInitDto extends Record<string, unknown> {
    /** Original filename */
    fileName: string;
    /** MIME type of the file */
    contentType: string;
    /** File size in bytes */
    fileSize: number;
    /** Target bucket (documents or public) */
    bucket?: StorageBucket;
    /** Folder path within the bucket */
    folder?: string;
    /** Whether the file should be publicly accessible */
    isPublic?: boolean;
    /** Optional title for the file */
    title?: string;
    /** Optional description */
    description?: string;
}

/**
 * Request to confirm upload completion
 */
export interface UploadConfirmDto extends Record<string, unknown> {
    /** Upload reference from init response */
    reference: string;
}

// ============================================================================
// API Responses
// ============================================================================

/**
 * Upload initialization response
 */
export interface UploadInitResponse {
    /** Unique reference for the upload */
    reference: string;
    /** Presigned URL for uploading */
    uploadUrl: string;
    /** Target bucket */
    bucket: StorageBucket;
    /** File path in storage */
    path: string;
    /** URL expiry in seconds */
    expiresIn: number;
    /** Gallery record ID */
    galleryId: string;
}

/**
 * Upload confirmation response
 */
export interface UploadConfirmResponse {
    /** Whether confirmation was successful */
    success: boolean;
    /** Gallery record with view URL */
    gallery?: GalleryResponse;
    /** Error message if failed */
    error?: string;
}

/**
 * Gallery record response
 */
export interface GalleryResponse {
    id: string;
    reference: string;
    title: string | null;
    description: string | null;
    filetype: string;
    extension: string;
    size: string;
    height: number | null;
    width: number | null;
    bucket: string;
    is_public: boolean;
    type: GalleryType;
    status: GalleryStatus;
    view_url?: string;
    created_at: string;
    updated_at: string;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Gallery creation input
 */
export interface CreateGalleryInput {
    uploadedById: bigint;
    reference: string;
    title?: string | null;
    description?: string | null;
    filetype: string;
    extension: string;
    size: bigint;
    bucket: string;
    isPublic: boolean;
    type: GalleryType;
    path: string;
}

/**
 * Transform gallery to response format
 */
export const toGalleryResponse = (gallery: Gallery, viewUrl?: string): GalleryResponse => {
    const response: GalleryResponse = {
        id: gallery.id.toString(),
        reference: gallery.reference,
        title: gallery.title,
        description: gallery.description,
        filetype: gallery.filetype,
        extension: gallery.extension,
        size: gallery.size.toString(),
        height: gallery.height,
        width: gallery.width,
        bucket: gallery.bucket,
        is_public: gallery.isPublic,
        type: gallery.type,
        status: gallery.status,
        created_at: gallery.createdAt.toISOString(),
        updated_at: gallery.updatedAt.toISOString()
    };
    if (viewUrl !== undefined) {
        response.view_url = viewUrl;
    }
    return response;
};
