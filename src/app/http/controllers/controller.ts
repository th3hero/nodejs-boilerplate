/**
 * Base Controller
 * Abstract controller with common response methods and validation
 */

import { validateInput } from '@th3hero/request-validator';
import type { Request, Response } from 'express';
import { ERROR_CODES, ROLES, getPermissionScope, PERMISSION_SCOPES } from '@core/constants';
import type { PermissionModule } from '@core/constants';
import { AuthenticatedRequest } from '@core/types';
import { getRequestId } from '@middleware/request-context.middleware';

export abstract class Controller {
    /**
     * Get authenticated user ID or send 401 response
     * Returns null if user is not authenticated (response already sent)
     */
    protected requireAuth(req: Request, res: Response): bigint | null {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.id;
        if (!userId) {
            this.sendErrorResponse(
                res,
                { auth: 'User not authenticated' },
                ERROR_CODES.UNAUTHORIZED,
                'User not authenticated',
                401
            );
            return null;
        }
        return userId;
    }

    /**
     * Get optional authenticated user ID (no error if missing)
     */
    protected getAuthUserId(req: Request): bigint | undefined {
        return (req as AuthenticatedRequest).user?.id;
    }

    /**
     * Check if user has 'all' scope for a module (can access all resources)
     * Super admin always has 'all' scope
     */
    protected hasAllScope(req: Request, module: PermissionModule): boolean {
        const authReq = req as AuthenticatedRequest;

        // Super admin bypasses scope checks
        if (authReq.user?.role?.slug === ROLES.SUPER_ADMIN) {
            return true;
        }

        const scope = getPermissionScope(authReq.permissions, module);
        return scope === PERMISSION_SCOPES.ALL;
    }

    /**
     * Get the owner filter for queries based on user's scope
     * Returns undefined if user has 'all' scope (no filter needed)
     * Returns userId if user has 'own' scope (must filter to own resources)
     */
    protected getOwnerFilter(req: Request, module: PermissionModule): bigint | undefined {
        if (this.hasAllScope(req, module)) {
            return undefined; // No filter - user can see all
        }
        return this.getAuthUserId(req); // Filter to user's own resources
    }

    /**
     * Check if user can access a specific resource based on scope
     * @param req - Request object
     * @param module - Permission module
     * @param resourceOwnerId - The owner ID of the resource being accessed
     * @returns true if user can access, false otherwise
     */
    protected canAccessResource(req: Request, module: PermissionModule, resourceOwnerId: bigint): boolean {
        // User has 'all' scope - can access any resource
        if (this.hasAllScope(req, module)) {
            return true;
        }

        // User has 'own' scope - can only access their own resources
        const userId = this.getAuthUserId(req);
        return userId !== undefined && userId === resourceOwnerId;
    }

    /**
     * Verify user can access a resource, send 403 if not
     * Returns true if access granted, false if denied (response already sent)
     */
    protected verifyResourceAccess(
        req: Request,
        res: Response,
        module: PermissionModule,
        resourceOwnerId: bigint
    ): boolean {
        if (this.canAccessResource(req, module, resourceOwnerId)) {
            return true;
        }

        this.sendErrorResponse(
            res,
            { access: 'You do not have permission to access this resource' },
            ERROR_CODES.PERMISSION_DENIED,
            'Access denied',
            403
        );
        return false;
    }

    /**
     * Parse and validate BigInt ID from route params
     * Returns null if invalid (response already sent)
     */
    protected parseBigIntParam(req: Request, res: Response, paramName: string, entityName: string): bigint | null {
        const rawParam = req.params[paramName];
        const param = Array.isArray(rawParam) ? rawParam[0] : rawParam;

        if (!param) {
            this.sendErrorResponse(
                res,
                { [paramName]: `${entityName} ID is required` },
                ERROR_CODES.VALIDATION_ERROR,
                `${entityName} ID is required`,
                400
            );
            return null;
        }

        try {
            return BigInt(param);
        } catch {
            this.sendErrorResponse(
                res,
                { [paramName]: `Invalid ${entityName} ID` },
                ERROR_CODES.VALIDATION_ERROR,
                `Invalid ${entityName} ID`,
                400
            );
            return null;
        }
    }

    /**
     * Parse and validate string param from route params
     * Returns null if missing (response already sent)
     */
    protected parseStringParam(req: Request, res: Response, paramName: string, label: string): string | null {
        const rawParam = req.params[paramName];
        const param = Array.isArray(rawParam) ? rawParam[0] : rawParam;

        if (!param) {
            this.sendErrorResponse(
                res,
                { [paramName]: `${label} is required` },
                ERROR_CODES.VALIDATION_ERROR,
                `${label} is required`,
                400
            );
            return null;
        }

        return param;
    }

    /**
     * Send a success response
     */
    public sendSuccessResponse = (
        res: Response,
        data: object | null | string | number | [],
        message: string = 'Successfully Executed',
        statusCode: number = 200
    ): Response => {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            statusCode,
            timestamp: new Date().toISOString(),
            requestId: getRequestId()
        });
    };

    /**
     * Send an error response
     */
    public sendErrorResponse = (
        res: Response,
        error: object | string | number | string[] | [],
        errorCode: string,
        message: string = 'Something Went Wrong',
        statusCode: number = 500
    ): Response => {
        return res.status(statusCode).json({
            success: false,
            message,
            error_code: errorCode,
            error,
            timestamp: new Date().toISOString(),
            requestId: getRequestId()
        });
    };

    /**
     * Validate request body against rules
     */
    public async validate<T extends Record<string, unknown>>(
        req: Request,
        res: Response,
        rules: Record<string, string>
    ): Promise<T | null> {
        try {
            if (!req.body) req.body = {};
            const validation = await validateInput(req, rules);
            if (validation.failed) {
                this.sendErrorResponse(
                    res,
                    validation.errors ?? {},
                    ERROR_CODES.VALIDATION_ERROR,
                    'Input validation failed',
                    422
                );
                return null;
            }
            return req.body as T;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Validation error occurred';
            this.sendErrorResponse(
                res,
                { message: errorMessage },
                ERROR_CODES.VALIDATION_ERROR,
                'Input validation failed',
                422
            );
            return null;
        }
    }
}
