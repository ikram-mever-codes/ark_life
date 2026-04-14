"use client";
import React, { useState, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/app/Redux/store";
import { logout } from "@/app/Redux/features/userSlice";
import { clearTokens } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

const Header: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.user);
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    clearTokens();
    dispatch(logout());
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="flex h-8 w-8 items-center justify-center border-2 border-primary rounded-sm">
            <span className="font-bold text-lg text-primary">A</span>
          </div>
          <span className="text-xl font-bold tracking-tight">ArkLife</span>
        </Link>

        {/* Desktop Navigation - Only visible if logged in */}
        {user && (
          <nav className="hidden md:flex items-center gap-6">
            {["Dashboard", "Avatars", "Settings", "Memory"].map((item) => (
              <Link
                key={item}
                href={`/${item.toLowerCase()}`}
                className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors"
              >
                {item}
              </Link>
            ))}
          </nav>
        )}

        {/* Actions Section */}
        <div className="flex items-center gap-4">
          {!user ? (
            <>
              <Link
                href="/login"
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="bg-primary px-4 py-2 text-sm font-bold text-black rounded-md hover:brightness-110 transition-all"
              >
                GET STARTED
              </Link>
            </>
          ) : (
            <div className="relative" ref={dropdownRef}>
              {/* Profile Trigger */}
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 group focus:outline-none"
              >
                <div className="h-8 w-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs uppercase">
                  {user.firstName?.charAt(0) || "U"}
                </div>
                <span className="text-sm font-medium hidden sm:block group-hover:text-primary">
                  {user.firstName || "Account"}
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-background py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="px-4 py-2 border-b border-border mb-1">
                    <p className="text-xs text-gray-500 truncate">
                      {user.email}
                    </p>
                  </div>

                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    Profile Settings
                  </Link>

                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    Subscription
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
