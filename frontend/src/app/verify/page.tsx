// app/verify/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { verifyEmail, resendVerification } from "@/api/auth";

const VerifyPage: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (token) {
      verifyEmail(token)
        .then(() => {
          setStatus("success");
          setMessage("Email verified successfully!");
        })
        .catch((error) => {
          setStatus("error");
          setMessage(error.response?.data?.message || "Verification failed");
        });
    } else {
      setStatus("error");
      setMessage("No verification token provided");
    }
  }, [token]);

  const handleResend = async () => {
    if (!email) {
      setMessage("Please enter your email address");
      return;
    }

    try {
      await resendVerification(email);
      setMessage("Verification email sent! Please check your inbox.");
    } catch (error) {
      setMessage("Failed to send verification email");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-[#0a0f19] rounded-lg p-8 text-center">
        {status === "loading" && (
          <>
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">
              Verifying your email...
            </h2>
            <p className="text-gray-400">
              Please wait while we verify your email address.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 mb-6">
              <svg
                className="h-8 w-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">
              Email Verified!
            </h2>
            <p className="text-gray-400 mb-8">
              Your email has been successfully verified. You can now log in to
              your account.
            </p>
            <Link
              href="/login"
              className="inline-block bg-primary text-black px-8 py-3 rounded-md font-bold hover:brightness-110 transition-all"
            >
              Go to Login
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 mb-6">
              <svg
                className="h-8 w-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">
              Verification Failed
            </h2>
            <p className="text-gray-400 mb-6">{message}</p>

            <div className="border-t border-gray-800 pt-6">
              <p className="text-gray-400 mb-4">
                Need a new verification email?
              </p>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/20 border border-border px-4 py-3 text-sm rounded-md focus:outline-none focus:border-primary transition-all mb-4"
              />
              <button
                onClick={handleResend}
                className="w-full bg-primary text-black px-8 py-3 rounded-md font-bold hover:brightness-110 transition-all"
              >
                Resend Verification Email
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyPage;
