"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSubscription = exports.authenticate = void 0;
const jwt_1 = require("../utils/jwt");
const User_1 = __importDefault(require("../models/User"));
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "No token provided",
            });
        }
        const token = authHeader.split(" ")[1];
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        // Check if user still exists
        const user = await User_1.default.findById(decoded.userId).select("-password");
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }
        req.user = user;
        next();
    }
    catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
};
exports.authenticate = authenticate;
const requireSubscription = (tier) => {
    return (req, res, next) => {
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
exports.requireSubscription = requireSubscription;
//# sourceMappingURL=auth.js.map