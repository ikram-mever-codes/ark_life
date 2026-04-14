"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCheckOnPassword = exports.useCheckOnEmail = exports.validatePassword = exports.validateEmail = void 0;
const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};
exports.validateEmail = validateEmail;
const validatePassword = (password) => {
    if (password.length < 6) {
        return { valid: false, message: "Password must be at least 6 characters" };
    }
    return { valid: true };
};
exports.validatePassword = validatePassword;
const useCheckOnEmail = (email) => {
    const regEx = /^[a-zA-Z][^@\s]*@[^@\s]+\.com$/;
    if (!regEx.test(email.trim()))
        return false;
    const checkAt = email.match(/@/g) ?? [];
    const checkCom = email.match(/\.com/g) ?? [];
    if (checkAt.length > 1 || checkCom.length > 1)
        return false;
    return true;
};
exports.useCheckOnEmail = useCheckOnEmail;
const useCheckOnPassword = (password) => {
    if (password.length < 6)
        return false;
    return true;
};
exports.useCheckOnPassword = useCheckOnPassword;
//# sourceMappingURL=validation.js.map