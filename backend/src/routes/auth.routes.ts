// routes/auth.routes.ts
import { Router } from "express";
import authController, { AuthController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";

const router: any = Router();

// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout);
router.get("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerification);
router.post("/verify-otp", authController.verifyOtp);
router.post("/resend-otp", authController.resendOtp);
router.post("/forgot-password", authController.forgotPasswordOTP);
router.post("/reset-password", authController.resetPassword);
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
