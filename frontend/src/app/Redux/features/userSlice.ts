// userSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types matching your MongoDB schema
export type SubscriptionTier = "free" | "pro" | "business";

export interface UserState {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  gender?: string;
  dob?: Date | string;
  region?: string;
  bio?: string;
  subscriptionTier: SubscriptionTier;
  credits: number;
  isEmailVerified: boolean;
  isOnboarded: boolean;
  lastLogin?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}
export interface InitialState {
  user: UserState | null;
  loading: boolean;
  error?: string | null;
}

const initialState: InitialState = {
  user: null,
  loading: true,
  error: null,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },

    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },

    // Login - sets the full user object
    login(state, action: PayloadAction<UserState>) {
      state.user = action.payload;
      state.loading = false;
      state.error = null;
    },

    // Logout - clears user data
    logout(state) {
      state.user = null;
      state.loading = false;
      state.error = null;
    },

    // Signup/Register - sets user after registration
    signup(state, action: PayloadAction<UserState>) {
      state.user = action.payload;
      state.loading = false;
      state.error = null;
    },

    // Update specific user fields
    updateUser(state, action: PayloadAction<Partial<UserState>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },

    // Update subscription tier
    updateSubscriptionTier(state, action: PayloadAction<SubscriptionTier>) {
      if (state.user) {
        state.user.subscriptionTier = action.payload;
      }
    },

    // Update credits
    updateCredits(state, action: PayloadAction<number>) {
      if (state.user) {
        state.user.credits = action.payload;
      }
    },

    // Add credits (useful for purchases)
    addCredits(state, action: PayloadAction<number>) {
      if (state.user) {
        state.user.credits += action.payload;
      }
    },

    // Deduct credits (useful for using services)
    deductCredits(state, action: PayloadAction<number>) {
      if (state.user && state.user.credits >= action.payload) {
        state.user.credits -= action.payload;
      }
    },

    // Update email verification status
    updateEmailVerification(state, action: PayloadAction<boolean>) {
      if (state.user) {
        state.user.isEmailVerified = action.payload;
      }
    },

    // Update last login time
    updateLastLogin(state, action: PayloadAction<Date | string>) {
      if (state.user) {
        state.user.lastLogin = action.payload;
      }
    },

    // Update user profile (name, etc.)
    updateProfile(
      state,
      action: PayloadAction<Partial<Pick<UserState, "firstName" | "lastName">>>,
    ) {
      if (state.user && action.payload.firstName) {
        state.user.firstName = action.payload.firstName;
      }
      if (state.user && action.payload.lastName) {
        state.user.lastName = action.payload.lastName;
      }
    },

    // Reset user state (for testing or error recovery)
    resetUser(state) {
      state.user = null;
      state.loading = false;
      state.error = null;
    },

    // Clear error
    clearError(state) {
      state.error = null;
    },
  },
});

// Export actions
export const {
  setLoading,
  setError,
  login,
  logout,
  signup,
  updateUser,
  updateSubscriptionTier,
  updateCredits,
  addCredits,
  deductCredits,
  updateEmailVerification,
  updateLastLogin,
  updateProfile,
  resetUser,
  clearError,
} = userSlice.actions;

// Selectors
export const selectUser = (state: { user: InitialState }) => state.user.user;
export const selectUserId = (state: { user: InitialState }) =>
  state.user.user?.id;
export const selectUserEmail = (state: { user: InitialState }) =>
  state.user.user?.email;
export const selectUserName = (state: { user: InitialState }) =>
  `${state.user.user?.firstName || ""} ${state.user.user?.lastName || ""}`.trim();
export const selectSubscriptionTier = (state: { user: InitialState }) =>
  state.user.user?.subscriptionTier;
export const selectCredits = (state: { user: InitialState }) =>
  state.user.user?.credits;
export const selectIsEmailVerified = (state: { user: InitialState }) =>
  state.user.user?.isEmailVerified;
export const selectIsAuthenticated = (state: { user: InitialState }) =>
  !!state.user.user;
export const selectLoading = (state: { user: InitialState }) =>
  state.user.loading;
export const selectError = (state: { user: InitialState }) => state.user.error;

export default userSlice.reducer;
