import React from "react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative      border-t border-white/5 bg-background overflow-hidden">
      {/* Subtle Background Glow for Depth */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-arklife-primary/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand Column */}
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-full border border-arklife-primary flex items-center justify-center">
                <div className="w-2 h-2 bg-arklife-primary rounded-full animate-ping"></div>
              </div>
              <span className="text-xl font-bold tracking-widest uppercase">
                ArkLife
              </span>
            </div>
            <p className="text-foreground/60 text-sm leading-relaxed">
              Bridging the gap between biological identity and digital presence.
              The next evolution of the Personal Cloud.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-arklife-primary text-xs font-bold uppercase tracking-[0.2em] mb-6">
              System
            </h4>
            <ul className="space-y-4 text-sm text-foreground/50">
              <li>
                <a
                  href="#"
                  className="hover:text-arklife-primary transition-colors"
                >
                  Digital Twins
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-arklife-primary transition-colors"
                >
                  Voice Synthesis
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-arklife-primary transition-colors"
                >
                  Neural RAG
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-arklife-primary transition-colors"
                >
                  API Console
                </a>
              </li>
            </ul>
          </div>

          {/* Compliance */}
          <div>
            <h4 className="text-arklife-primary text-xs font-bold uppercase tracking-[0.2em] mb-6">
              Security
            </h4>
            <ul className="space-y-4 text-sm text-foreground/50">
              <li>
                <a
                  href="#"
                  className="hover:text-arklife-primary transition-colors"
                >
                  Data Sovereignty
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-arklife-primary transition-colors"
                >
                  Encryption Protocol
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-arklife-primary transition-colors"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-arklife-primary transition-colors"
                >
                  NDA Terms
                </a>
              </li>
            </ul>
          </div>

          {/* Status/Newsletter */}
          <div className="glass-panel p-6 border-white/10">
            <h4 className="text-foreground text-xs font-bold uppercase tracking-[0.2em] mb-4">
              Network Status
            </h4>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-arklife-accent shadow-[0_0_8px_#39ff14]"></div>
              <span className="text-[10px] font-mono text-arklife-accent uppercase">
                All Systems Operational
              </span>
            </div>
            <div className="relative">
              <input
                type="email"
                placeholder="Secure Email..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs focus:outline-none focus:border-arklife-primary transition-all"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 text-arklife-primary font-bold text-[10px] hover:brightness-125">
                JOIN
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/5 gap-4">
          <div className="flex items-center gap-6">
            <span className="text-[10px] font-mono text-foreground/30 uppercase">
              © {currentYear} ArkLife Systems Corp.
            </span>
            <span className="text-[10px] font-mono text-foreground/30 uppercase hidden md:block">
              Build v1.0.4-Beta
            </span>
          </div>

          <div className="flex gap-4">
            {/* Social Icons Placeholder */}
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-md border border-white/5 flex items-center justify-center hover:bg-white/5 cursor-pointer transition-all"
              >
                <div className="w-3 h-3 bg-foreground/40 rounded-sm"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
