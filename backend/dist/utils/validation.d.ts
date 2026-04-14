export declare const validateEmail: (email: string) => boolean;
export declare const validatePassword: (password: string) => {
    valid: boolean;
    message?: string;
};
export declare const useCheckOnEmail: (email: string) => boolean;
export declare const useCheckOnPassword: (password: string) => boolean;
