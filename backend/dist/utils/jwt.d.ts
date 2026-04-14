interface TokenPayload {
    userId: string;
    email: string;
    subscriptionTier: string;
}
export declare const generateAccessToken: (payload: TokenPayload) => string;
export declare const generateRefreshToken: (payload: TokenPayload) => string;
export declare const verifyAccessToken: (token: string) => TokenPayload;
export declare const verifyRefreshToken: (token: string) => TokenPayload;
export declare const generateTokens: (user: any) => {
    accessToken: string;
    refreshToken: string;
};
export {};
