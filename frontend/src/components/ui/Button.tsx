"use client";

import React from "react";

type Props = {
    type?: "button" | "submit" | "reset";
    onClick?: () => void,
    icon?: React.ReactNode,
    text?: string,
    btnClass?: string,
    textClass?: string,
    disable?: boolean,
    focusOn?: boolean,
    nonFocus?: boolean
}

export default function Button({type="button", onClick, icon, text, btnClass, textClass, disable=false, focusOn=false, nonFocus=false}: Props){

    const focusStyle = "bg-primary py-4 mt-4 rounded-md hover:brightness-110 transition-all uppercase tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed";
    const nonFocusStyle = "border border-border mb-3 py-3 px-4 rounded-md text-xs font-semibold hover:bg-white/5 transition-all disabled:opacity-50";

    return(
        <button
            type={type}
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            disabled={disable}
            className={`w-full flex flex-row gap-3 items-center justify-center ${btnClass || ""} ${focusOn ? focusStyle : ""} ${nonFocus ? nonFocusStyle : ""}`}
        >
            <span>{icon}</span>
            <span className={`${textClass || ""}`}>{text}</span>
        </button>
    )
}