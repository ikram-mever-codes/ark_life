import { Response, NextFunction } from "express";
export declare const checkPlanAccess: (action: "createAvatar" | "sendMessage") => (req: any, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
