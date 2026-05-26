"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
    state: boolean,
    parentClose?: boolean,
    parentStyle?: string,
    onClose?: () => void,
    cardStyle?: string,
    children: React.ReactNode,
    container?: HTMLElement | null
}

export default function Toaster({ children, state, parentClose=false, onClose, cardStyle, parentStyle, container=null }: Props){

    const cardRef = useRef<HTMLDivElement | null>(null);
    const [cardState, setCardState] = useState(false);
    const timer = useRef<any>(null);
    const ref = useRef<HTMLElement | null>(container);

    useLayoutEffect(() => {
        ref.current = container;
    }, [container]);

    useLayoutEffect(() => {
        setCardState(state);
        
        if(state){
            timer.current = setTimeout(() => {
                onClose?.();
            }, 3000);
        }else{
            if(timer.current) clearTimeout(timer.current);
        }

    }, [state])


    return(
        createPortal(
            <section 
                className={`bg-transparent absolute top-0 left-0 flex w-full h-full ${parentStyle || "justify-center"} ${state ? parentClose ? "pointer-events-auto" : "pointer-events-none" : "pointer-events-none"}`} 
                onClick={(e) => {
                    e.stopPropagation();
                    if(parentClose) onClose?.();
                }}
            > 
                <div ref={cardRef} className={`transition-transform duration-200 w-fit h-fit translate-y-10 ease-in-out ${cardStyle || ""} ${cardState ? "scale-100 pointer-events-auto" : "scale-0 pointer-events-none delay-300"}`}>
                    {children}
                </div>
            </section>
            , 
            ref?.current || document.body
        ) 
    )
}