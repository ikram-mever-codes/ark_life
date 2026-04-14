import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
export declare class AvatarController {
    /**
     * INTERNAL: Triggers D-ID Cloud API
     */
    private generateMasterLoop;
    /** Remove an image or voice sample */
    removeAsset: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    /** Set Hero Image */
    setHeroImage: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    /** CREATE Avatar with Subscription Restriction */
    create: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    list: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    getOne: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    update: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    remove: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    cloneVoice: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    upload: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    testSpeech: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
}
declare const _default: AvatarController;
export default _default;
