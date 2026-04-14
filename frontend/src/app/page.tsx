"use client";
import { useRouter } from "next/navigation"; // Changed from next/router
import { useEffect } from "react";

const Page = () => {
  const router = useRouter();

  useEffect(() => {
    router.push("/dashboard"); // Fixed typo and removed 'return'
  }, [router]);

  return null; // A component must return JSX or null
};

export default Page;
