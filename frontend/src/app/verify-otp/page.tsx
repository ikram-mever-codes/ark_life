"use client";

import { LeftBar } from "@section";
import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { Toaster, OTP } from "@custom";
import { Button } from "@ui";
import { BiArrowBack } from "react-icons/bi";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { verifyOtp, resendOtp } from "@/api/auth";
import { setTokens } from "@/components/AuthProvider";
import { login } from "@/app/Redux/features/userSlice";
import { AppDispatch } from "@/app/Redux/store";
import {
  VERIFY_OTP_EMAIL_KEY,
  VERIFY_OTP_FORGOT_PASSWORD_KEY,
} from "@/utils/verifyOtpStorage";

export default function Page() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [email, setEmail] = useState("");
  const [forgotPassword, setForgotPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [showToaster, setShowToaster] = useState(false);
  const [toasterMessage, setToasterMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedEmail = localStorage.getItem(VERIFY_OTP_EMAIL_KEY) ?? "";
    const storedForgot =
      localStorage.getItem(VERIFY_OTP_FORGOT_PASSWORD_KEY) === "true";
    setEmail(storedEmail);
    setForgotPassword(storedForgot);
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError(
        forgotPassword
          ? "Email is missing. Please go back to Forgot password."
          : "Email is missing. Please complete sign up first.",
      );
      return;
    }
    if (otp.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await verifyOtp(email, otp, forgotPassword);
      if (forgotPassword) {
        const resAny = res as { resetToken?: string; email?: string };
        if (resAny?.resetToken) {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              "reset_password_token",
              resAny.resetToken,
            );
            window.localStorage.setItem(
              "reset_password_email",
              resAny.email ?? email,
            );
          }
          setToasterMessage("Code verified. Redirecting to reset password...");
          setTimeout(() => router.push("/reset-password"), 1500);
        } else {
          setToasterMessage("Code verified. Redirecting...");
          setTimeout(() => router.push("/login"), 1500);
        }
      } else {
        if (res.data?.access_token && res.data?.refresh_token) {
          const user = res.data.user as any;
          const userEmail = user?.email ?? email;
          setTokens(res.data.access_token, res.data.refresh_token, userEmail);
          if (user) {
            if (!user.id && user._id) user.id = user._id;
            dispatch(login(user));
          }
        }
        setToasterMessage("Email verified! Redirecting to dashboard...");
        setTimeout(() => router.push("/dashboard"), 1500);
      }
      setShowToaster(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || "Verification failed.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Email is missing.");
      return;
    }
    setError(null);
    setResendLoading(true);
    try {
      await resendOtp(email);
      setToasterMessage("A new 6-digit code has been sent to your email.");
      setShowToaster(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || "Failed to resend code.";
      setError(msg);
    } finally {
      setResendLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen bg-background items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  const title = forgotPassword ? "Enter OTP" : "Verify your email";
  const fallbackLink = forgotPassword ? "/forgot-password" : "/signup";
  const fallbackLabel = forgotPassword ? "Forgot password" : "Sign up";

  return (
    <main className="flex min-h-[calc(100vh)] bg-background">
      <LeftBar />
      <div
        id="verify-otp-container"
        className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative"
      >
        <div className="flex flex-col gap-8 w-full max-w-[400px]">
          <div className="flex flex-col gap-4">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              {title}
            </h2>
            <div
              className="flex items-center gap-2 w-fit cursor-pointer"
              onClick={() => router.back()}
            >
              <BiArrowBack size={20} color="#fff" />
              <p className="text-sm text-gray-500">Go Back</p>
            </div>
          </div>

          {email ? (
            <p className="text-sm text-gray-400">
              We sent a 6-digit code to{" "}
              <span className="text-white font-mono">{email}</span>
            </p>
          ) : (
            <p className="text-sm text-amber-500">
              No email found. Please go to{" "}
              <Link href={fallbackLink} className="text-primary underline">
                {fallbackLabel}
              </Link>
              .
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {email && (
              <>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-wider text-gray-500">
                    Enter 6-digit code
                  </label>
                  <OTP length={6} onChange={setOtp} />
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500 rounded-md">
                    <p className="text-red-500 text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  className={`w-full flex flex-row gap-3 items-center justify-center bg-primary py-4 mt-4 rounded-md hover:brightness-110 transition-all uppercase tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLoading && (
                    <div className="border-2 border-white/50 border-t-white animate-spin w-[24px] h-[24px] rounded-full bg-transparent" />
                  )}
                  <span className="text-sm text-black font-bold">
                    {isLoading
                      ? "Verifying..."
                      : forgotPassword
                        ? "Verify code"
                        : "Verify email"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="text-sm text-primary font-bold hover:underline disabled:opacity-50"
                >
                  {resendLoading ? "Sending..." : "Resend code"}
                </button>
              </>
            )}
          </form>
        </div>
        <Toaster
          container={document.getElementById("verify-otp-container")}
          state={showToaster}
          parentClose={true}
          onClose={() => setShowToaster(false)}
          cardStyle="bg-black border border-white/20 rounded-md p-3"
        >
          <p className="text-white text-base">{toasterMessage}</p>
        </Toaster>
      </div>
    </main>
  );
}
