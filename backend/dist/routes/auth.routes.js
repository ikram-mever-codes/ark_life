"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/auth.routes.ts
const express_1 = require("express");
const auth_controller_1 = __importDefault(require("../controllers/auth.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public routes
router.post("/register", auth_controller_1.default.register);
router.post("/login", auth_controller_1.default.login);
router.post("/refresh-token", auth_controller_1.default.refreshToken);
router.post("/logout", auth_controller_1.default.logout);
router.get("/verify-email", auth_controller_1.default.verifyEmail);
router.post("/resend-verification", auth_controller_1.default.resendVerification);
router.post("/verify-otp", auth_controller_1.default.verifyOtp);
router.post("/resend-otp", auth_controller_1.default.resendOtp);
router.post("/forgot-password", auth_controller_1.default.forgotPasswordOTP);
router.post("/reset-password", auth_controller_1.default.resetPassword);
router.post("/onboard", auth_1.authenticate, auth_controller_1.default.onboardUser);
// Protected routes
router.get("/profile", auth_1.authenticate, auth_controller_1.default.getProfile);
router.put("/profile", auth_1.authenticate, auth_controller_1.default.updateProfile);
router.put("/stats", auth_1.authenticate, auth_controller_1.default.getSystemOverview);
// Identity & Security Protocols
router.put("/change-password", auth_1.authenticate, auth_controller_1.default.changePassword);
router.put("/update-profile", auth_1.authenticate, auth_controller_1.default.updateDetailedProfile);
router.put("/update-subscription", auth_1.authenticate, auth_controller_1.default.updateSubscription);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map