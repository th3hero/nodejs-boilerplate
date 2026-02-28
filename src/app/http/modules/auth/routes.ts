/**
 * Auth Routes
 */

import { Router } from 'express';

// Middleware imports
import { authCheck, authRefresh, loginRateLimiter, otpRateLimiter, passwordResetRateLimiter } from '@middleware/index';

// Module imports
import controller from './controller';

const router = Router();

// OTP-based authentication
router.post('/phone', otpRateLimiter, controller.sendOTP);
router.post('/verify/:type', controller.verifyOTP);
router.post('/otp/resend', otpRateLimiter, controller.resendOTP);

// Password-based authentication
router.post('/login', loginRateLimiter, controller.passwordLogin);
router.post('/password/forgot', passwordResetRateLimiter, controller.forgotPassword);
router.post('/password/reset', controller.resetPassword);

// Session management
router.get('/me', authCheck, controller.me);
router.put('/me/avatar', authCheck, controller.updateAvatar);
router.post('/logout', authCheck, controller.logout);
router.post('/refresh', authRefresh, controller.refreshToken);

export default router;
