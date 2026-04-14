"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/app/Redux/store";
import { login } from "@/app/Redux/features/userSlice";
import { toast } from "react-hot-toast";
import { FaGoogle } from "react-icons/fa";
import { Button, Input } from "@ui";
import { LeftBar } from "@section";
import { loginSubmit } from "@/api/auth";
import { setTokens } from "@/components/AuthProvider";
import { setVerifyOtpStorage } from "@/utils/verifyOtpStorage";
import axios from "axios";
import { BASE_URL, errorStyles } from "@/utils/constants";

const LoginPage: React.FC = () => {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
        email: email.trim(),
        password: password.trim(),
      });

      if (result.data.success) {
        const { access_token, refresh_token, user } = result.data.data;

        setTokens(access_token, refresh_token, user?.email);
        console.log(access_token, refresh_token, user);
        // Format the user object for Redux
        const userToStore = { ...user };
        if (!userToStore.id && userToStore._id)
          userToStore.id = userToStore._id;

        // IMPORTANT: Ensure userToStore.isOnboarded is coming from the backend here
        dispatch(login(userToStore));

        toast.success(`Welcome back, ${userToStore?.firstName ?? "User"}!`);
        router.push("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.response.data.message, errorStyles);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <main className="flex min-h-[calc(100vh)] bg-background">
      <LeftBar />
      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight">
              Login to ArkLife
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-primary hover:underline font-medium"
              >
                Get started for free
              </Link>
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-md">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          <Button
            onClick={() => toast.error("Google login coming soon!")}
            text="Continue with Google"
            disable={isLoading}
            icon={<FaGoogle size={14} color="#fff" />}
            nonFocus={true}
          />

          <div className="relative mb-8 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <span className="relative bg-background px-2 text-[10px] uppercase tracking-widest text-gray-500">
              Or continue with email
            </span>
          </div>

          <form
            onSubmit={(e: any) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-4"
          >
            <Input
              placeholder="name@company.com"
              label="EMAIL"
              inLabel={true}
              value={email}
              onChange={(text: string) => setEmail(text)}
              type="email"
              disable={isLoading}
              inInput={true}
            />
            <Input
              type="password"
              value={password}
              onChange={(text: string) => setPassword(text)}
              ExtraLabel={() => (
                <Link
                  href="/forgot-password"
                  className="text-xs font-bold text-gray-500"
                >
                  FORGOT?
                </Link>
              )}
              inInput={true}
              label="PASSWORD"
              inLabel={true}
              placeholder="••••••••"
              disable={isLoading}
              labelContainer="flex flex-row justify-between items-center"
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
              text={isLoading ? "Signing in..." : "Sign In"}
            />
          </form>

          <p className="mt-8 text-center text-[10px] text-gray-600 leading-relaxed px-4">
            By clicking continue, you agree to our
            <Link href="/terms" className="underline mx-1">
              Terms of Service
            </Link>
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
