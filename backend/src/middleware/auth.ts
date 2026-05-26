import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import User from "../models/User";

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    // Check if user still exists
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export const requireSubscription = (tier: "pro" | "business") => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user.subscriptionTier === "free") {
      return res.status(403).json({
        success: false,
        message: `Upgrade to ${tier} tier to access this feature`,
      });
    }

    if (tier === "business" && req.user.subscriptionTier !== "business") {
      return res.status(403).json({
        success: false,
        message: "Business tier required for this feature",
      });
    }

    next();
  };
};
