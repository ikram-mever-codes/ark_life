"use client";

import React, { useRef, useState } from "react";

type Props = {
  length?: number;
  onChange?: (otp: string) => void;
};

export default function OTPInput({ length = 6, onChange }: Props) {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(""));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = (index: number) => {
    inputsRef.current[index]?.focus();
    inputsRef.current[index]?.select();
  };

  const handleChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    const otpString = newOtp.join("");
    onChange?.(otpString);

    if (value && index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        focusInput(index - 1);
      }
    }

    if (e.key === "ArrowLeft" && index > 0) {
      focusInput(index - 1);
    }

    if (e.key === "ArrowRight" && index < length - 1) {
      focusInput(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();

    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);

    const newOtp = pasted.split("");
    while (newOtp.length < length) newOtp.push("");

    setOtp(newOtp);
    onChange?.(newOtp.join(""));

    const focusIndex = Math.min(pasted.length, length - 1);
    focusInput(focusIndex);
  };

  return (
    <div 
        className={`grid gap-2`} 
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
    >
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el: any) => (inputsRef.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(e.target.value, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          className="px-2 py-4 text-center text-lg font-semibold border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-white"
        />
      ))}
    </div>
  );
}