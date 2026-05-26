"use client";

import React, { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input } from "@ui";
import { LeftBar } from "@section";
import { resetPasswordSubmit } from "@/api/auth";

const RESET_TOKEN_KEY = "reset_password_token";
const RESET_EMAIL_KEY = "reset_password_email";

function clearResetStorage() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(RESET_TOKEN_KEY);
    window.localStorage.removeItem(RESET_EMAIL_KEY);
  }
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setEmail(window.localStorage.getItem(RESET_EMAIL_KEY) ?? "");
      setResetToken(window.localStorage.getItem(RESET_TOKEN_KEY) ?? "");
      setMounted(true);
    }
  }, []);

  const handleSubmit = async () => {

    setError(null);
    if (!email || !resetToken) {
      setError("OTP verification required. Please complete OTP verification from forgot password again.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      await resetPasswordSubmit(email, resetToken, newPassword);
      clearResetStorage();
      router.push("/login");
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  if (mounted && (!email || !resetToken)) {
    return (
      <main className="flex min-h-[calc(100vh)] bg-background">
        <LeftBar />
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-[400px]">
            <h1 className="text-3xl font-bold tracking-tight">Reset password</h1>
            <p className="text-sm text-gray-500 mt-2 mb-6">
              OTP verification required. Please complete OTP verification from forgot password again.
            </p>
            <Link
              href="/forgot-password"
              className="text-primary hover:underline font-medium"
            >
              Go to Forgot password
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh)] bg-background">
      <LeftBar />
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight">
              Set new password
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              Enter your new password below.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-md">
              <p className="text-red-500 text-sm">{error}</p>
              {error.toLowerCase().includes("otp verification required") && (
                <Link
                  href="/forgot-password"
                  className="inline-block mt-2 text-sm text-primary hover:underline"
                >
                  Go to Forgot password
                </Link>
              )}
            </div>
          )}

          <form onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
          }} className="space-y-4">
            <Input
              type="password"
              label="NEW PASSWORD"
              inLabel={true}
              value={newPassword}
              onChange={(text: string) => setNewPassword(text)}
              placeholder="••••••••"
              disable={isLoading}
              inInput={true}
            />
            <Input
              type="password"
              label="CONFIRM PASSWORD"
              inLabel={true}
              value={confirmPassword}
              onChange={(text: string) => setConfirmPassword(text)}
              placeholder="••••••••"
              disable={isLoading}
              inInput={true}
            />
            <Button
              type="submit"
              disable={isLoading}
              icon={
                isLoading && (
                  <div className="bg-black border-2 border-white/50 border-t-white animate-spin w-[15px] h-[15px] rounded-full bg-transparent" />
                )
              }
              focusOn={true}
              textClass="text-xs text-black uppercase font-extrabold"
              text={isLoading ? "Resetting..." : "Reset password"}
            />
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Remember your password?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
