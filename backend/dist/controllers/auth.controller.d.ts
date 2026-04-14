import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
export declare class AuthController {
    register: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    sendVerificationEmail: (user: any) => Promise<boolean>;
    sendOTPEmail: (user: any) => Promise<boolean>;
    forgotPasswordOTP: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    verifyEmail(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    resendVerification(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    verifyOtp: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    resendOtp: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    resetPassword: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    login: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
    refreshToken: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    getProfile: (req: Request, res: Response) => Promise<void>;
    updateProfile: (req: Request, res: Response) => Promise<void>;
    logout: (req: Request, res: Response) => Promise<void>;
    onboardUser: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    changePassword: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    updateDetailedProfile: (req: Request, res: Response) => Promise<void>;
    updateSubscription: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    getSystemOverview: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
}
declare const _default: AuthController;
export default _default;
