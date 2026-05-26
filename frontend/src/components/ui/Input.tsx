"use client";

import React, { useState } from "react";
import { IoMdEye, IoMdEyeOff } from "react-icons/io";

type Props = {
    type?: string, 
    value?: string, 
    onChange?: (text: string) => void,
    inInput?: boolean,
    labelStyle?: string, 
    inputStyle?: string,
    placeholder?: string,
    label?: string,
    disable?: boolean,
    inLabel?: boolean,
    ExtraLabel?: () => React.ReactNode | null,
    labelContainer?: string
}

export default function Input({type="text", value="", onChange, inInput=false, labelStyle="", inputStyle="", placeholder, label="", disable=false, inLabel=false, ExtraLabel, labelContainer=""}: Props){

    const [onPassword, setOnPassword] = useState(false);
    const style = "bg-black/20 border border-border text-sm rounded-md focus-within:border-primary transition-colors";
    const lblStyle = "text-xs font-bold text-gray-500 tracking-widest";

    const onToggle = (e: any, state: boolean) => {
        e.stopPropagation();
        setOnPassword(state);
    }

    return(
        <div className={`flex flex-col gap-2 `}>
            <div className={`${labelContainer || ""}`}>
                <p className={`${labelStyle || ""} ${inLabel ? lblStyle : ""}`}>{label}</p>
                {ExtraLabel && ExtraLabel()}
            </div>
            <div className={`flex flex-row justify-between items-center ${inInput ? style : ""} ${type == "password" ? "pr-3" : ""}`}>
                <input 
                    type={type == "password" ? onPassword ? "text" : "password" : type}
                    disabled={disable}
                    value={value}
                    onChange={(e: any) => onChange?.(e.target.value)}
                    placeholder={placeholder}
                    className={`${inputStyle || ""} focus:outline-none px-4 py-2.5  ${type == "password" ? "w-[95%]" : "w-full"}`}
                />
                {type == "password" ? onPassword ? <div onClick={(e) => onToggle(e, false)}>
                    <IoMdEye size={20} color="#fff" />
                </div> : <div onClick={(e) => onToggle(e, true)}>
                    <IoMdEyeOff size={20} color="#fff" />
                  </div> : null}
            </div>
        </div>
    )
}