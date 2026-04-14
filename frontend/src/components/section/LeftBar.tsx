"use client";

export default function LeftBar(){
    return(
        <div className="hidden lg:flex w-1/2 bg-[#070a10] border-r border-border p-12 flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
                <div className="h-10 w-10 border-2 border-primary flex items-center justify-center mb-8">
                <span className="font-bold text-primary">A</span>
                </div>
                <h2 className="text-4xl font-bold leading-tight tracking-tighter">
                The next evolution of <br />
                <span className="text-primary">Digital Presence.</span>
                </h2>
                <p className="mt-4 text-gray-400 max-w-sm">
                Scale your interactive avatars with enterprise-grade voice cloning
                and real-time genomic integration.
                </p>
            </div>
            <div className="relative z-10">
                <div className="flex gap-4 items-center">
                <div className="flex -space-x-2">
                    {Array.from({length: 3}).map((_, index: number) => (
                    <div
                        key={index}
                        className="w-8 h-8 rounded-full border-2 border-[#070a10] bg-gray-800"
                    />
                    ))}
                </div>
                <p className="text-xs text-gray-500 font-mono">
                    JOIN 500+ ENTERPRISE TEAMS
                </p>
                </div>
            </div>

            <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                backgroundImage:
                    "radial-gradient(var(--color-border) 1px, transparent 0)",
                backgroundSize: "24px 24px",
                }}
            />
        </div>
    )
}