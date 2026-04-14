"use client";

import { LeftBar } from "@section";
import { useState } from "react";
import { Input, Button } from "@ui";
import { BiArrowBack } from "react-icons/bi";
import { useRouter } from "next/navigation";
import { useCheck } from "@/utils/util";
import { setVerifyOtpStorage } from "@/utils/verifyOtpStorage";
import { forgotPasswordSubmit } from "@/api/auth";
import { toast } from "react-hot-toast";

export default function Page() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {

        const hasErrors = useCheck({ email }, "email", "", () => {}, (msg) => setError(msg));
        if (hasErrors) return;

        setIsLoading(true);
        setError(null);

        try {
            const res = await forgotPasswordSubmit(email);
            if (res.success) {
                setVerifyOtpStorage(res.email ?? email, res.forgotPassword ?? true);
                toast.success(res.message ?? "Code sent successfully.");
                router.push("/verify-otp");
                return;
            }
            setError(res.message ?? "Something went wrong.");
        } catch (err: any) {
            const msg = err.response?.data?.message ?? err.message ?? "Something went wrong. Try again.";
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="flex min-h-[calc(100vh)] bg-background">
            <LeftBar />
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
                <div className="flex flex-col gap-8 w-full max-w-[400px]">
                    <div className="flex flex-col gap-4">
                        <h2 className="text-3xl font-bold tracking-tight text-white">Forgot Password</h2>
                        <div className="flex items-center gap-2 w-fit cursor-pointer" onClick={() => router.back()}>
                            <BiArrowBack size={20} color="#fff" />
                            <p className="text-sm text-gray-500">Go Back</p>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500 rounded-md">
                            <p className="text-red-500 text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handleSubmit();
                    }} className="flex flex-col gap-6">
                        <Input
                            type="email"
                            label="EMAIL"
                            value={email}
                            onChange={(text: string) => setEmail(text)}
                            inInput={true}
                            inLabel={true}
                            placeholder="name@company.com"
                            disable={isLoading}
                        />
                        <Button
                            type="submit"
                            focusOn={true}
                            disable={isLoading}
                            text={isLoading ? "Sending..." : "SEND VERIFICATION LINK"}
                            textClass="text-sm text-black font-bold"
                            icon={isLoading && (
                                <div className="bg-black border-2 border-white/50 border-t-white animate-spin w-[20px] h-[20px] rounded-full bg-transparent" />
                            )}
                        />
                    </form>
                </div>
            </div>
        </main>
    );
}