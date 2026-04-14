// controllers/auth.controller.ts
import { Request, Response } from "express";
import User from "../models/User";
import { generateTokens, verifyRefreshToken } from "../utils/jwt";
import { useCheckOnEmail, useCheckOnPassword } from "../utils/validation";
import sendEmail from "../services/emailService";
import {
  getVerificationEmailTemplate,
  getWelcomeEmailTemplate,
  getOTPEmailTemplate,
} from "../utils/emailTemplates";
import crypto from "crypto";
import connectDB from "../config/database";
import MemoryChunk from "../models/MemoryChunk";
import Avatar from "../models/Avatar";
import { AuthRequest } from "../middleware/auth";

export class AuthController {
  // Register new user
  register = async (req: Request, res: Response) => {
    console.log("jsonBody: ", req.body);

    const email = req.body.email?.trim();
    const password = req.body.password?.trim();
    const firstName = req.body.firstName?.trim();
    const lastName = req.body.lastName?.trim();

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        message: "Email, password, first name, and last name are required",
      });
    }

    if (!useCheckOnEmail(email)) {
      return res.status(400).json({
        message: "Incorrect email, Please write correct email",
      });
    }

    if (!useCheckOnPassword(password))
      return res.status(400).json({
        message:
          "Incorrect Password, Password should be greater than 6 and shouldn't include special character only characters, numbers and underscore",
      });

    connectDB()
      .then(async (hasConnected: boolean) => {
        if (!hasConnected)
          throw new Error(
            "Sorry!, Server couldn't handle your request. Try some time later",
          );

        const hasUser = await User.findOne({ email: email.toLowerCase() });

        if (hasUser) {
          if (hasUser.isEmailVerified) {
            return res.status(409).json({
              message: "Account already exists",
            });
          }
          let sent = false;
          try {
            sent = await this.sendOTPEmail(hasUser);
          } catch (otpErr: any) {
            console.error(
              "Register: sendOTPEmail error (existing user):",
              otpErr?.message || otpErr,
            );
          }
          return res.status(sent ? 200 : 500).json({
            message: sent
              ? "A new OTP has been sent to your email."
              : "Account already exists and OTP is not sent successfully.",
          });
        }

        try {
          const createUser = await User.create({
            firstName,
            lastName,
            email,
            password,
          });
          let sent = false;
          try {
            sent = await this.sendOTPEmail(createUser);
          } catch (otpErr: any) {
            console.error(
              "Register: sendOTPEmail error (new user):",
              otpErr?.message || otpErr,
            );
          }
          if (sent) {
            return res.status(201).json({
              message:
                "Your account has been created. Please check your email for the OTP.",
            });
          }
          return res.status(500).json({
            message: "Account created. Failure to send OTP code.",
          });
        } catch (err: any) {
          console.log("failure: ", err?.message);
          return res.status(500).json({
            message: err?.message || "Failure to create your account",
          });
        }
      })
      .catch((err: any) => {
        return res.status(500).json({
          message: err?.message || "Sorry!, Server isn't alive",
        });
      });
  };

  // Sending Verification Email on user created and if email not verfiied
  sendVerificationEmail = async (user: any) => {
    try {
      const verifyToken = user.generateEmailVerificationToken();
      await user.save();

      const link = `${process.env.FRONTEND_URL}/verify?token=${verifyToken}`;

      await sendEmail({
        to: user.email,
        subject: "Verify Your Email - ArkLife (Reminder)",
        html: getVerificationEmailTemplate(user.firstName, link),
      });

      return true;
    } catch (err: any) {
      console.log("error sending Email: ", err?.message || "");
    }

    return false;
  };

  // Send OTP to user email (uses User.generateOTP)
  sendOTPEmail = async (user: any): Promise<boolean> => {
    try {
      const otp = user.generateOTP();
      await user.save();
      await sendEmail({
        to: user.email,
        subject: "Your verification code - ArkLife",
        html: getOTPEmailTemplate(user.firstName, otp),
      });
      return true;
    } catch (err: any) {
      console.log("error sending OTP email: ", err?.message || "");
    }
    return false;
  };

  forgotPasswordOTP = async (req: Request, res: Response) => {
    try {
      const emailRaw = req.body.email?.trim();
      if (!emailRaw) {
        return res
          .status(400)
          .json({ success: false, message: "Email is required" });
      }
      if (!useCheckOnEmail(emailRaw)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email. Please enter a valid email.",
        });
      }

      const email = emailRaw.toLowerCase();
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Email doesn't exist",
        });
      }

      let sent = false;
      try {
        sent = await this.sendOTPEmail(user);
      } catch (otpErr: any) {
        console.error(
          "Forgot password: sendOTPEmail error:",
          otpErr?.message || otpErr,
        );
      }

      if (!sent) {
        return res.status(500).json({
          success: false,
          message: user.isEmailVerified
            ? "Your account exists but we couldn't send the code. Try again shortly."
            : "Account exists but OTP could not be sent. Try again shortly.",
        });
      }

      if (user.isEmailVerified) {
        return res.status(200).json({
          success: true,
          message: "Your account exists and code sent successfully.",
          forgotPassword: true,
          email: user.email,
        });
      }

      return res.status(200).json({
        success: true,
        message: "This is for account OTP.",
        forgotPassword: false,
        email: user.email,
      });
    } catch (err: any) {
      console.error("Forgot password error:", err);
      return res.status(500).json({
        success: false,
        message: err?.message || "Something went wrong. Try again later.",
      });
    }
  };

  // Verify email
  async verifyEmail(req: Request, res: Response) {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Verification token is required",
        });
      }

      // Hash the token
      const hashedToken = crypto
        .createHash("sha256")
        .update(token as string)
        .digest("hex");

      // Find user with valid token
      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired verification token",
        });
      }

      // Update user
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      // Send welcome email
      try {
        await sendEmail({
          to: user.email,
          subject: "Welcome to ArkLife!",
          html: getWelcomeEmailTemplate(user.firstName),
        });
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }

      res.json({
        success: true,
        message: "Email verified successfully",
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  async resendVerification(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: "Email already verified",
        });
      }

      // Generate new verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Send verification email
      const verificationLink = `${process.env.FRONTEND_URL}/verify?token=${verificationToken}`;

      await sendEmail({
        to: user.email,
        subject: "Verify Your Email - ArkLife",
        html: getVerificationEmailTemplate(user.firstName, verificationLink),
      });

      res.json({
        success: true,
        message: "Verification email sent successfully",
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Verify OTP (signup/unverified account or forgot-password)
  verifyOtp = async (req: Request, res: Response) => {
    try {
      const { email, otp, forgotPassword } = req.body;
      const otpTrim = typeof otp === "string" ? otp.trim() : "";
      const isForgotPassword =
        forgotPassword === true || forgotPassword === "true";

      if (!email || !otpTrim) {
        return res.status(400).json({
          success: false,
          message: "Email and OTP are required",
        });
      }
      if (!/^\d{6}$/.test(otpTrim)) {
        return res.status(400).json({
          success: false,
          message: "OTP must be 6 digits",
        });
      }

      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      if (!user.otpCode || user.otpCode !== otpTrim) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP",
        });
      }
      if (!user.otpExpires || user.otpExpires < new Date()) {
        return res.status(400).json({
          success: false,
          message: "OTP has expired. Please request a new code.",
        });
      }

      if (isForgotPassword) {
        const resetToken = (user as any).setPasswordResetToken();
        user.otpCode = undefined;
        user.otpExpires = undefined;
        await user.save();
        return res.status(200).json({
          success: true,
          message: "Code verified. You can reset your password.",
          resetToken,
          email: user.email,
        });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: "Email is already verified. Please login.",
        });
      }

      user.isEmailVerified = true;
      user.otpCode = undefined;
      user.otpExpires = undefined;
      await user.save();

      sendEmail({
        to: user.email,
        subject: "Welcome to ArkLife!",
        html: getWelcomeEmailTemplate(user.firstName),
      }).catch((emailError) =>
        console.error("Failed to send welcome email:", emailError),
      );

      const tokens = generateTokens(user);
      return res.json({
        success: true,
        message: "Email verified successfully",
        data: {
          user: user.toJSON(),
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        },
      });
    } catch (error) {
      console.error("Verify OTP error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Resend OTP (6-digit code) for email verification
  resendOtp = async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      const emailTrim = email?.trim();

      if (!emailTrim) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const user = await User.findOne({ email: emailTrim.toLowerCase() });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: "Email is already verified. Please login.",
        });
      }

      const sent = await this.sendOTPEmail(user);
      return res.status(sent ? 200 : 500).json({
        success: sent,
        message: sent
          ? "A new 6-digit code has been sent to your email."
          : "Failed to send OTP. Please try again.",
      });
    } catch (error) {
      console.error("Resend OTP error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Reset password (after OTP verified for forgot-password; token valid 20 min)
  resetPassword = async (req: Request, res: Response) => {
    try {
      const emailRaw = req.body.email?.trim();
      const resetTokenRaw = req.body.resetToken?.trim();
      const newPassword = req.body.newPassword?.trim();

      if (!emailRaw || !resetTokenRaw || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Email, reset token, and new password are required",
        });
      }
      if (!useCheckOnPassword(newPassword)) {
        return res.status(400).json({
          success: false,
          message:
            "Password should be greater than 6 and only include characters, numbers and underscore",
        });
      }

      const email = emailRaw.toLowerCase();
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const hashedToken = crypto
        .createHash("sha256")
        .update(resetTokenRaw)
        .digest("hex");

      if (
        !user.passwordResetToken ||
        user.passwordResetToken !== hashedToken ||
        !user.passwordResetExpires ||
        user.passwordResetExpires < new Date()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "OTP verification required. Please complete OTP verification from forgot password again.",
        });
      }

      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Password updated successfully. You can now log in.",
      });
    } catch (error: any) {
      console.error("Reset password error:", error);
      return res.status(500).json({
        success: false,
        message: error?.message || "Internal server error",
      });
    }
  };

  // Login user
  login = async (req: Request, res: Response) => {
    try {
      const emailRaw = req.body.email?.trim();
      const password = req.body.password?.trim();

      if (!emailRaw || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      const email = emailRaw.toLowerCase();
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // User exists but email not verified: send OTP and tell frontend to show verify link
      if (!user.isEmailVerified) {
        let sent = false;
        try {
          sent = await this.sendOTPEmail(user);
        } catch (otpError: any) {
          console.error(
            "Login: sendOTPEmail error:",
            otpError?.message || otpError,
          );
        }
        return res.status(403).json({
          success: false,
          message: sent
            ? "We've sent a 6-digit code to your email. Please verify to continue."
            : "Your account is not verified and we couldn't send you an email.",
          requiresVerification: true,
          email: user.email,
        });
      }

      const tokens = generateTokens(user);
      user.lastLogin = new Date();
      await user.save();

      return res.json({
        success: true,
        message: "Login successful",
        data: {
          user: user.toJSON(),
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Refresh token
  refreshToken = async (req: Request, res: Response) => {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({
          success: false,
          message: "Refresh token is required",
        });
      }

      // Verify refresh token
      const decoded = verifyRefreshToken(refresh_token);

      // Find user
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Generate new tokens
      const tokens = generateTokens(user);

      res.json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          access_token: tokens.accessToken,
        },
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }
  };

  // Get current user profile
  getProfile = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Update user profile
  updateProfile = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { firstName, lastName } = req.body;

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { firstName, lastName },
        { new: true, runValidators: true },
      ).select("-password");

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  // Logout
  logout = async (req: Request, res: Response) => {
    res.json({
      success: true,
      message: "Logout successful",
    });
  };

  // controllers/auth.controller.ts

  onboardUser = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user._id;
      const {
        firstName,
        lastName,
        gender,
        dob,
        region,
        bio,
        subscriptionTier,
      } = req.body;

      // Validation: Ensure required fields are present
      if (!firstName || !lastName || !subscriptionTier) {
        return res.status(400).json({
          success: false,
          message: "Missing required onboarding data",
        });
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          firstName,
          lastName,
          gender,
          dob,
          region,
          bio,
          subscriptionTier,
          isOnboarded: true,
        },
        { new: true },
      ).select("-password");

      console.log(updatedUser);

      res.json({
        success: true,
        message: "Neural synchronization complete",
        data: updatedUser,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  changePassword = async (req: Request, res: Response) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const user = await User.findById((req as any).user._id);

      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      // Verify current password
      const isMatch = await user.comparePassword(oldPassword);
      if (!isMatch) {
        return res
          .status(400)
          .json({ success: false, message: "Current password incorrect" });
      }

      // Validate new password strength
      if (!useCheckOnPassword(newPassword)) {
        return res.status(400).json({
          success: false,
          message: "New password does not meet security requirements",
        });
      }

      user.password = newPassword; // The pre-save hook in User model will hash this
      await user.save();

      res.json({
        success: true,
        message: "Neural access key updated successfully",
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // 2. Update Detailed Profile (Identity Calibration)
  updateDetailedProfile = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user._id;
      const { firstName, lastName, gender, dob, region, bio, avatar } =
        req.body;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { firstName, lastName, gender, dob, region, bio, avatar },
        { new: true, runValidators: true },
      ).select("-password");

      res.json({
        success: true,
        message: "Identity calibration successful",
        data: updatedUser,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  // 3. Update Subscription Tier
  updateSubscription = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user._id;
      const { tier } = req.body;

      if (!["free", "pro", "business"].includes(tier)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid subscription protocol" });
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { subscriptionTier: tier },
        { new: true },
      ).select("-password");

      res.json({
        success: true,
        message: `Access tier elevated to ${tier.toUpperCase()}`,
        data: updatedUser,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
  getSystemOverview = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;

    try {
      // 1. Calculate Real Stats
      const memoryCount = await MemoryChunk.countDocuments({ userId });
      const avatarCount = await Avatar.countDocuments({ userId });
      const activeAvatar = await Avatar.findOne({ userId }).sort({
        updatedAt: -1,
      });

      // 2. Fetch User Credits (Mocking ElevenLabs/OpenAI usage from User model)
      const user = await User.findById(userId);

      return res.status(200).json({
        success: true,
        data: {
          stats: [
            { label: "Neural Latency", value: "24ms", status: "optimal" },
            {
              label: "Memory Vault",
              value: `${memoryCount} Chunks`,
              status: "synced",
            },
            {
              label: "Active Nodes",
              value: avatarCount.toString(),
              status: "active",
            },
          ],
          trainingProgress: activeAvatar ? 100 : 0, // 100% if avatar exists
          vaultUsage: Math.min((memoryCount / 1000) * 100, 100), // Max 1000 chunks for base plan
          credits: user?.credits || 0,
          activeAvatarId: activeAvatar?._id || null,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false });
    }
  };
}

export default new AuthController();
