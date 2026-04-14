"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPlanAccess = void 0;
const plans_1 = require("../config/plans");
const User_1 = __importDefault(require("../models/User"));
const checkPlanAccess = (action) => {
    return async (req, res, next) => {
        const user = await User_1.default.findById(req.user._id);
        if (!user)
            return res.status(404).json({ message: "User not found" });
        const plan = plans_1.SUBSCRIPTION_PLANS[user.subscriptionTier];
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
exports.checkPlanAccess = checkPlanAccess;
//# sourceMappingURL=subscriptionGuard.js.map