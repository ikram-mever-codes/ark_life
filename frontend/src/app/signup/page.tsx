// app/signup/page.tsx
"use client";

import React, { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { registerSignup } from "@/api/auth";
import { setVerifyOtpStorage } from "@/utils/verifyOtpStorage";
import { FaGoogle } from "react-icons/fa";
import { Button, Input } from "@ui";
import { useCheck } from "@/utils/util";

const SignupPage: React.FC = () => {
  const router = useRouter();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (key: string, value: string) => {
    setFormData({
      ...formData,
      // [e.target.name]: e.target.value,
      [key]: value
    });
  };

  const handleSignup = async () => {
    const hasErrors = useCheck(formData, "email", "password", () => {}, (msg) => toast.error(msg));

    if (hasErrors) return;

    setIsLoading(true);
    setError(null);

    try {
      await registerSignup(formData);
      setVerifyOtpStorage(formData.email, false);
      router.push("/verify-otp");
    } catch (err: any) {
      const message =
        err.response?.data?.message || err.message || "Registration failed";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-background">
      {/* Brand & Trust Panel (Left) */}
      <div className="hidden lg:flex w-5/12 bg-[#0a0f19] border-r border-border p-12 flex-col justify-between">
        <div>
          <div className="inline-flex h-10 w-10 items-center justify-center border-2 border-primary rounded-sm mb-12">
            <span className="font-bold text-primary">A</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-6">
            Build your digital legacy <br /> with ArkLife Enterprise.
          </h2>

          <ul className="space-y-6">
            {[
              {
                title: "Universal Avatars",
                desc: "Deploy to web, mobile, and VR in one click.",
              },
              {
                title: "Neural Sovereignty",
                desc: "You own your training data. Always.",
              },
              {
                title: "Tier-1 Latency",
                desc: "Sub-50ms response times globally.",
              },
            ].map((feature, idx) => (
              <li key={idx} className="flex gap-4">
                <div className="mt-1 h-4 w-4 rounded-full border border-accent flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {feature.title}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-8 border-t border-border">
          <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-4">
            Trusted by innovative teams
          </p>
          <div className="flex gap-6 opacity-30 grayscale hover:grayscale-0 transition-all">
            <div className="h-4 w-16 bg-white/20 rounded-sm" />
            <div className="h-4 w-16 bg-white/20 rounded-sm" />
            <div className="h-4 w-16 bg-white/20 rounded-sm" />
          </div>
        </div>
      </div>

      {/* Conversion Form (Right) */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 text-center lg:text-left">
                <h1 className="text-3xl font-bold tracking-tight">
                  Create your account
                </h1>
                <p className="text-sm text-gray-500 mt-2">
                  Start your 14-day free trial. No credit card required.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-md">
                  <p className="text-red-500 text-sm">{error}</p>
                </div>
              )}

              <Button 
                  icon={<FaGoogle size={14} color="#fff" />}
                  text="Continue with Google"
                  onClick={() => toast.error("Feature coming soon")}
                  nonFocus={true}
              />
              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <span className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] text-gray-500">
                  <span className="bg-background px-4">Work Email Signup</span>
                </span>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                handleSignup();
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                      type="text"
                      value={formData.firstName}
                      onChange={(text: string) => handleChange("firstName", text)}
                      inInput={true}
                      label="FIRST NAME"
                      inLabel={true}
                      placeholder="John"
                      disable={isLoading}
                  />

                  <Input 
                      type="text"
                      value={formData.lastName}
                      onChange={(text: string) => handleChange("lastName", text)}
                      inInput={true}
                      label="LAST NAME"
                      inLabel={true}
                      disable={isLoading}
                      placeholder="Doe"
                  />
                </div>
                  
                <Input 
                    type="email"
                    label="EMAIL"
                    inInput={true}
                    disable={isLoading}
                    value={formData.email}
                    onChange={(text: string) => handleChange("email", text)}
                    inLabel={true}
                    placeholder="name@company.com"
                />

                <Input 
                    type="password"
                    inInput={true}
                    disable={isLoading}
                    placeholder="••••••••"
                    inLabel={true}
                    label="PASSWORD"
                    value={formData.password}
                    onChange={(text: string) => handleChange("password", text)}  
                />
                <Button 
                    type="submit"
                    disable={isLoading}
                    icon={isLoading && <div className="bg-black border-2 border-white/50 border-t-white animate-spin w-[24px] h-[24px] rounded-full bg-transparent" />}
                    focusOn={true}
                    textClass="text-xs text-black uppercase font-extrabold"
                    text={isLoading ? "Creating Account..." : "Initialize Workspace"}
                /> 
              </form>

              <p className="mt-10 text-center text-xs text-gray-500">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-primary font-bold hover:underline"
                >
                  Sign In
                </Link>
              </p>

          <p className="mt-12 text-[10px] text-gray-600 text-center leading-relaxed">
            ArkLife ensures your biological data is encrypted with AES-256. By
            signing up, you consent to our{" "}
            <a href="#" className="underline">
              Biometric Processing Policy
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
};

export default SignupPage;
