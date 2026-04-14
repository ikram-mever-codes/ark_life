// api/authApi.ts
import { toast } from "react-hot-toast";
import { api, handleApiError, sendRequest } from "../utils/api";
import {
  login,
  logout,
  setLoading,
  updateUser,
  UserState,
} from "../app/Redux/features/userSlice";
import { AppDispatch } from "@/app/Redux/store";
import { loadingStyles, successStyles } from "@/utils/constants";
import { setTokens, clearTokens } from "@/components/AuthProvider";
import { ResponseInterface } from "@/utils/interfaces";

interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: UserState;
    access_token: string;
    refresh_token: string;
  };
}

interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
}

// ==================== PUBLIC ROUTES ====================

export interface RegisterResponse {
  message: string;
}

/**
 * POST /register
 * Register a new user. Sends OTP if new or unverified email.
 * - New email: creates user, sends OTP
 * - Existing unverified: sends OTP
 * - Existing verified: returns error "Email already exists, please login"
 */
export const registerSignup = async (
  payload: RegisterPayload,
): Promise<RegisterResponse> => {
  const response = await api.post<RegisterResponse>(
    "/api/v1/auth/register",
    payload,
  );
  return response as any;
};

export const registerUser = async (
  userData: RegisterPayload,
  dispatch: AppDispatch,
) => {
  try {
    toast.loading("Creating account...", loadingStyles);
    const response = await api.post<LoginResponse>("/auth/register", userData);

    if (response.data.success) {
      // Store tokens
      setTokens(
        response.data.data.access_token,
        response.data.data.refresh_token,
      );

      dispatch(login(response.data.data.user));
      toast.dismiss();
      toast.success(
        "Registration successful! Please verify your email.",
        successStyles,
      );
    }
    return response.data;
  } catch (error) {
    handleApiError(error, "Registration failed");
    throw error;
  }
};

export type LoginResult =
  | { success: true; data: LoginResponse["data"] }
  | { requiresVerification: true; email: string; message?: string };

/**
 * POST /login - for login page: returns result or throws (no toasts).
 * Use for form submit: handle success, requiresVerification, or setError from throw.
 */
export const loginSubmit = async (
  email: string,
  password: string,
): Promise<LoginResult> => {
  try {
    const body = await api.post<
      LoginResponse | { requiresVerification: true; email: string }
    >("/api/v1/auth/login", { email: email.trim(), password });
    const res = body as any;
    if (res?.requiresVerification && res?.email) {
      return {
        requiresVerification: true,
        email: res.email,
        message: res.message,
      };
    }
    if (res?.success && res?.data) {
      return { success: true, data: res.data };
    }
    throw new Error(res?.message || "Login failed");
  } catch (error: any) {
    if (
      error.response?.data?.requiresVerification &&
      error.response?.data?.email
    ) {
      return {
        requiresVerification: true,
        email: error.response.data.email,
        message: error.response.data.message,
      };
    }
    throw error;
  }
};

/**
 * POST /login - with toasts and dispatch (e.g. for other flows)
 */
export const loginUser = async (
  email: string,
  password: string,
  dispatch: AppDispatch,
) => {
  try {
    toast.loading("Authenticating...", loadingStyles);
    const result: any = await loginSubmit(email, password);
    if (result.requiresVerification) {
      toast.dismiss();
      return result;
    }
    if (result.success && result.data) {
      const { access_token, refresh_token, user } = result.data;
      setTokens(access_token, refresh_token, user?.email);
      const u = user as any;
      if (u && !u.id && u._id) u.id = u._id;
      dispatch(login(u));
      toast.dismiss();
      toast.success(`Welcome ${user?.firstName ?? ""}!`, successStyles);
      return result;
    }
  } catch (error: any) {
    if (error.response?.data?.requiresVerification) {
      toast.dismiss();
      return {
        requiresVerification: true,
        email: error.response.data.email,
      };
    }
    handleApiError(error, "Login failed");
    throw error;
  }
};

/**
 * GET /verify-email
 * Verify email with token
 */
export const verifyEmail = async (token: string) => {
  try {
    toast.loading("Verifying email...", loadingStyles);
    const response = await api.get(`/auth/verify-email?token=${token}`);

    toast.dismiss();
    toast.success(
      "Email verified successfully! You can now log in.",
      successStyles,
    );
    return response.data;
  } catch (error) {
    handleApiError(error, "Email verification failed");
    throw error;
  }
};

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  data?: {
    user: UserState;
    access_token: string;
    refresh_token: string;
  };
}

export type VerifyOtpResponseForgotPassword = VerifyOtpResponse & {
  resetToken?: string;
  email?: string;
};

/**
 * POST /verify-otp
 * Verify OTP. If forgotPassword: true returns resetToken for reset-password. Else returns tokens for signup.
 */
export const verifyOtp = async (
  email: string,
  otp: string,
  forgotPassword?: boolean,
): Promise<VerifyOtpResponse | VerifyOtpResponseForgotPassword> => {
  const response = await api.post("/api/v1/auth/verify-otp", {
    email: email.trim(),
    otp: otp.trim(),
    forgotPassword: !!forgotPassword,
  });
  return response as any;
};

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  forgotPassword?: boolean;
  email?: string;
}

/**
 * POST /forgot-password
 * Request OTP for password reset (verified) or account verification (unverified).
 */
export const forgotPasswordSubmit = async (
  email: string,
): Promise<ForgotPasswordResponse> => {
  const response = await api.post<ForgotPasswordResponse>(
    "/api/v1/auth/forgot-password",
    { email: email.trim() },
  );
  return response as any;
};

/**
 * POST /reset-password
 * Set new password after OTP verified (reset token valid 20 min).
 */
export const resetPasswordSubmit = async (
  email: string,
  resetToken: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post<{ success: boolean; message: string }>(
    "/api/v1/auth/reset-password",
    {
      email: email.trim(),
      resetToken: resetToken.trim(),
      newPassword: newPassword.trim(),
    },
  );
  return response as any;
};

/**
 * POST /resend-otp
 * Resend 6-digit OTP to email for verification
 */
export const resendOtp = async (
  email: string,
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post<{ success: boolean; message: string }>(
    "/api/v1/auth/resend-otp",
    { email: email.trim() },
  );
  return response as any;
};

/**
 * POST /resend-verification
 * Resend verification email
 */
export const resendVerification = async (email: string) => {
  try {
    toast.loading("Sending verification email...", loadingStyles);
    const response = await api.post("/auth/resend-verification", { email });

    toast.dismiss();
    toast.success("Verification email sent successfully", successStyles);
    return response.data;
  } catch (error) {
    handleApiError(error, "Failed to send verification email");
    throw error;
  }
};

/**
 * POST /refresh-token
 * Get new access token using refresh token
 */
export const refreshToken = async (dispatch: AppDispatch) => {
  try {
    dispatch(setLoading(true));
    const refresh_token = localStorage.getItem("refresh_token");

    if (!refresh_token) {
      throw new Error("No refresh token");
    }

    const response = await api.post("/auth/refresh-token", { refresh_token });

    if (response.data.success) {
      localStorage.setItem("access_token", response.data.data.access_token);
    }

    return response.data;
  } catch (error) {
    handleApiError(error, "Session expired");
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

/**
 * POST /logout
 * Logout user and invalidate tokens
 */
export const logoutUser = async (dispatch: AppDispatch) => {
  try {
    dispatch(setLoading(true));
    await api.post("/auth/logout");
    clearTokens();
    dispatch(logout());
    toast.success("Logged out successfully", successStyles);
  } catch (error) {
    handleApiError(error, "Logout failed");
  } finally {
    dispatch(setLoading(false));
  }
};

// ==================== PROTECTED ROUTES ====================

/**
 * GET /profile
 * Get current user's profile
 */
export const getProfile = async () => {
  try {
    const response = await api.get("/auth/profile");
    return response.data;
  } catch (error) {
    handleApiError(error, "Failed to fetch profile");
    throw error;
  }
};

/**
 * PUT /profile
 * Update current user's profile
 */
export const updateProfile = async (
  profileData: UpdateProfilePayload,
  dispatch: AppDispatch,
) => {
  try {
    toast.loading("Updating profile...", loadingStyles);

    const response = await api.put("/auth/profile", profileData);

    dispatch(updateUser(response.data.data));
    toast.dismiss();
    toast.success("Profile updated successfully", successStyles);
    return response.data;
  } catch (error) {
    handleApiError(error, "Profile update failed");
    throw error;
  }
};

// Add to api/authApi.ts

interface OnboardingPayload {
  firstName: string;
  lastName: string;
  gender: string;
  dob: string;
  region: string;
  bio: string;
  subscriptionTier: string;
}

/**
 * POST /api/v1/auth/onboard
 * Complete user onboarding and set isOnboarded to true.
 */
export const onboardUserSubmit = async (
  payload: OnboardingPayload,
  dispatch: AppDispatch,
) => {
  try {
    toast.loading("Synchronizing neural baseline...", loadingStyles);

    // We use the raw api instance because it should already have the Authorization header
    // from the AuthProvider's apiClient interceptors or your local helper.
    const response = await api.post<any>("/api/v1/auth/onboard", payload);

    const res = response as any;

    if (res.success) {
      // Update Redux state with the new user data (isOnboarded will now be true)
      dispatch(updateUser(res.data));
      toast.dismiss();
      toast.success("Neural synchronization complete!", successStyles);
      return res.data;
    }

    throw new Error(res.message || "Onboarding failed");
  } catch (error: any) {
    toast.dismiss();
    handleApiError(error, "Onboarding protocol failed");
    throw error;
  }
};

/**
 * Update user password
 */
export const changePasswordSubmit = async (payload: any) => {
  try {
    toast.loading("Updating access keys...", loadingStyles);
    const response: any = await api.put(
      "/api/v1/auth/change-password",
      payload,
    );
    toast.dismiss();
    if (response.success) toast.success(response.message, successStyles);
    return response;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Update full profile details (including bio, avatar, etc.)
 */
export const updateDetailedProfileSubmit = async (
  payload: any,
  dispatch: AppDispatch,
) => {
  try {
    toast.loading("Recalibrating identity...", loadingStyles);
    const response: any = await api.put("/api/v1/auth/update-profile", payload);
    toast.dismiss();
    if (response.success) {
      dispatch(updateUser(response.data));
      toast.success("Identity updated", successStyles);
    }
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

/**
 * Update Subscription Tier
 */
export const updateSubscriptionSubmit = async (
  tier: string,
  dispatch: AppDispatch,
) => {
  try {
    toast.loading("Adjusting access tier...", loadingStyles);
    const response: any = await api.put("/api/v1/auth/update-subscription", {
      tier,
    });
    toast.dismiss();
    if (response.success) {
      dispatch(updateUser(response.data));
      toast.success(`Welcome to ${tier.toUpperCase()} tier!`, successStyles);
    }
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

export const getSystemOverviewSubmit = async (): Promise<any> => {
  try {
    // No toast loading here to keep the dashboard feel snappy
    const response = await api.put("/api/v1/auth/stats");
    const res = response as any;

    if (res.success) {
      return res.data;
    }

    throw new Error(res.message || "Failed to fetch system metrics");
  } catch (error: any) {
    console.error("System Metrics Sync Error:", error);
    throw error;
  }
};
