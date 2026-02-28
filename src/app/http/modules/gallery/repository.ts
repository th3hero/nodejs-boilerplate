/**
 * Gallery Repository
 * Database operations for gallery/file records
 */

import { prismaClient } from '@core/database';
import type { Gallery, GalleryStatus } from '@database/prisma';
import type { CreateGalleryInput } from './types';

/**
 * Create a new gallery record
 */
export const create = async (data: CreateGalleryInput): Promise<Gallery> => {
    return prismaClient.gallery.create({
        data: {
            uploadedById: data.uploadedById,
            reference: data.reference,
            filetype: data.filetype,
            extension: data.extension,
            size: data.size,
            bucket: data.bucket,
            isPublic: data.isPublic,
            type: data.type,
            status: 'pending',
            path: data.path,
            ...(data.title != null && { title: data.title }),
            ...(data.description != null && { description: data.description })
        }
    });
};

/**
 * Find gallery by ID
 */
export const findById = async (id: bigint): Promise<Gallery | null> => {
    return prismaClient.gallery.findUnique({
        where: { id }
    });
};

/**
 * Find gallery by reference
 */
export const findByReference = async (reference: string): Promise<Gallery | null> => {
    return prismaClient.gallery.findUnique({
        where: { reference }
    });
};

/**
 * Update gallery status
 */
export const updateStatus = async (id: bigint, status: GalleryStatus): Promise<Gallery> => {
    return prismaClient.gallery.update({
        where: { id },
        data: { status }
    });
};

/**
 * Update gallery with confirmed upload data
 */
export const confirmUpload = async (
    id: bigint,
    data: { size?: bigint | null; status: GalleryStatus }
): Promise<Gallery> => {
    return prismaClient.gallery.update({
        where: { id },
        data: {
            status: data.status,
            ...(data.size != null && { size: data.size })
        }
    });
};

/**
 * Delete gallery record
 */
export const deleteById = async (id: bigint): Promise<Gallery> => {
    return prismaClient.gallery.delete({
        where: { id }
    });
};

/**
 * Find galleries by user ID with pagination
 */
export const findByUserId = async (
    userId: bigint,
    options?: {
        limit?: number;
        offset?: number;
        status?: GalleryStatus;
    }
): Promise<{ galleries: Gallery[]; total: number }> => {
    const where = {
        uploadedById: userId,
        ...(options?.status && { status: options.status })
    };

    const [galleries, total] = await Promise.all([
        prismaClient.gallery.findMany({
            where,
            take: options?.limit ?? 50,
            skip: options?.offset ?? 0,
            orderBy: { createdAt: 'desc' }
        }),
        prismaClient.gallery.count({ where })
    ]);

    return { galleries, total };
};

/**
 * Find all galleries with pagination (admin scope)
 */
export const findAll = async (options?: {
    limit?: number;
    offset?: number;
    status?: GalleryStatus;
}): Promise<{ galleries: Gallery[]; total: number }> => {
    const where = {
        ...(options?.status && { status: options.status })
    };

    const [galleries, total] = await Promise.all([
        prismaClient.gallery.findMany({
            where,
            take: options?.limit ?? 50,
            skip: options?.offset ?? 0,
            orderBy: { createdAt: 'desc' },
            include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } }
        }),
        prismaClient.gallery.count({ where })
    ]);

    return { galleries, total };
};

export default {
    create,
    findById,
    findByReference,
    updateStatus,
    confirmUpload,
    deleteById,
    findByUserId,
    findAll
};
