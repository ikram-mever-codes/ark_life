import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
export declare class MemoryController {
    /** POST /add-memory – file upload (Multer) and/or neuralBio. Files stored in protected dir; background indexing. */
    addMemory: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    /** DELETE /api/v1/memory/files/:fileId */
    /** DELETE /api/v1/memory/files/:fileId */
    deleteMemory: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    /** GET /rag-query?q=... – vectorize query, similarity search, return top 3 chunks (userId-scoped) */
    ragQuery: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    /** GET /memory/vault – get current user's vault (files, neuralBio, vectorConfig status) */
    getVault: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
}
declare const _default: MemoryController;
export default _default;
