// src/middleware/subscriptionGuard.ts
import { Request, Response, NextFunction } from "express";
import { SUBSCRIPTION_PLANS } from "../config/plans";
import User from "../models/User";

export const checkPlanAccess = (action: "createAvatar" | "sendMessage") => {
  return async (req: any, res: Response, next: NextFunction) => {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const plan = SUBSCRIPTION_PLANS[user.subscriptionTier];

    if (action === "createAvatar") {
      if (user.useage.avatarCount >= plan.maxAvatars) {
        return res.status(403).json({
          message: `Upgrade to Pro to create more than ${plan.maxAvatars} avatar.`,
        });
      }
    }

    if (action === "sendMessage") {
      // Check message limits
      if (user.useage.monthlyMessageCount >= plan.monthlyMessages) {
        return res
          .status(403)
          .json({ message: "Monthly message limit reached." });
      }

      // Check specific "Credit" balance (if you use consumption-based billing)
      if (user.credits <= 0) {
        return res
          .status(403)
          .json({ message: "Insufficient credits for this transmission." });
      }
    }

    next();
  };
};
