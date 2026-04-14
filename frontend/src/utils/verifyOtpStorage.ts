export const VERIFY_OTP_EMAIL_KEY = "verify_otp_email";
export const VERIFY_OTP_FORGOT_PASSWORD_KEY = "verify_otp_forgot_password";

export function setVerifyOtpStorage(email: string, forgotPassword: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VERIFY_OTP_EMAIL_KEY, email);
  window.localStorage.setItem(
    VERIFY_OTP_FORGOT_PASSWORD_KEY,
    forgotPassword ? "true" : "false"
  );
}
