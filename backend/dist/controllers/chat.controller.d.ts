import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
export declare class ChatController {
    /**
     * GET /api/v1/chat/history/:avatarId
     */
    getHistory: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/v1/chat/interact
     * Implements Credit Guard and Atomic Deduction
     */
    interact: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
}
declare const _default: ChatController;
export default _default;
