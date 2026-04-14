"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import axios from "axios";
import { BASE_URL } from "@/utils/constants";
import { login, logout } from "@/app/Redux/features/userSlice";
import { AppDispatch, RootState } from "@/app/Redux/store";
import Loading from "@/app/loading";

// --- Token Storage Keys ---
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const EMAIL_KEY = "email";

export const setTokens = (
  accessToken: string,
  refreshToken: string,
  email?: string,
) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    if (email) {
      localStorage.setItem(EMAIL_KEY, email);
    }
  }
};

export const getAccessToken = () =>
  typeof window !== "undefined" ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;

export const getRefreshToken = () =>
  typeof window !== "undefined"
    ? localStorage.getItem(REFRESH_TOKEN_KEY)
    : null;

export const clearTokens = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  }
};

export const fetchUser = async (dispatch: AppDispatch) => {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      dispatch(logout());
      return null;
    }

    // 1. Refresh the access token
    // Using the /api/v1 prefix to match your login call
    const refreshResponse = await axios.post(
      `${BASE_URL}/api/v1/auth/refresh-token`,
      { refresh_token: refreshToken },
    );

    console.log("Refresh Response:", refreshResponse.data);

    if (refreshResponse.data.success) {
      // FIX: Ensure this path matches your Backend (data.data.access_token)
      const newAccessToken = refreshResponse.data.data.access_token;

      localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);

      // 2. Get user profile
      // FIX: Added /api/v1 to ensure consistency with other routes
      const profileResponse = await axios.get(
        `${BASE_URL}/api/v1/auth/profile`,
        {
          headers: { Authorization: `Bearer ${newAccessToken}` },
        },
      );

      if (profileResponse.data.success) {
        dispatch(login(profileResponse.data.data));
        return profileResponse.data.data;
      }
    }

    throw new Error("Invalid session");
  } catch (error) {
    console.error("Auth refresh failed:", error);
    dispatch(logout());
    clearTokens();
    return null;
  }
};
// --- Auth Provider Component ---
interface AuthProviderProps {
  children: ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSelector((state: RootState) => state.user);
  const [loading, setLoading] = useState<boolean>(true);
  const dispatch = useDispatch<AppDispatch>();

  const unprotectedRoutes = [
    "/login",
    "/signup",
    "/verify",
    "/forgot-password",
    "/reset-password",
  ];

  const onboardingRoutes = ["/setup/company", "/setup/contact"];

  const isUnprotectedRoute = unprotectedRoutes.some((route) =>
    pathname?.startsWith(route),
  );
  const isOnboardingRoute = onboardingRoutes.some((route) =>
    pathname?.startsWith(route),
  );

  // Bootstrap session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      if (getRefreshToken()) {
        await fetchUser(dispatch);
      }
      setLoading(false);
    };
    initializeAuth();
  }, [dispatch]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (!isUnprotectedRoute) {
        router.replace("/login");
      }
    } else {
      // Check for onboarding completion
      if (!user.isOnboarded && !isOnboardingRoute && !isUnprotectedRoute) {
        router.replace("/onboarding");
      }
      // Redirect logged-in/onboarded users away from auth pages
      else if (user.isOnboarded && isUnprotectedRoute) {
        router.replace("/dashboard");
      }
    }
  }, [loading, user, pathname, router, isUnprotectedRoute, isOnboardingRoute]);

  if (loading) return <Loading />;

  // Extra layer of protection: don't render children if we are expecting a user but don't have one
  if (!user && !isUnprotectedRoute) return <Loading />;

  return <>{children}</>;
};

export default AuthProvider;
