// routes/auth.routes.ts
import { Router } from "express";
import authController, { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import rateLimit from "express-rate-limit";

// Brute-force protection for login / OTP / password reset.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
});

const router: any = Router();

// Public routes
router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout);
router.get("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authLimiter, authController.resendVerification);
router.post("/verify-otp", authLimiter, authController.verifyOtp);
router.post("/resend-otp", authLimiter, authController.resendOtp);
router.post("/forgot-password", authLimiter, authController.forgotPasswordOTP);
router.post("/reset-password", authLimiter, authController.resetPassword);
router.post("/onboard", authenticate, authController.onboardUser);
// Protected routes
router.get("/profile", authenticate, authController.getProfile);
router.put("/profile", authenticate, authController.updateProfile);
router.put("/stats", authenticate, authController.getSystemOverview);

// Identity & Security Protocols
router.put("/change-password", authenticate, authController.changePassword);
router.put(
  "/update-profile",
  authenticate,
  authController.updateDetailedProfile,
);
router.put(
  "/update-subscription",
  authenticate,
  authController.updateSubscription,
);

export default router;
