import { toast } from "react-hot-toast";
import { api, handleApiError } from "../utils/api";
import { loadingStyles, successStyles } from "@/utils/constants";

const AVATARS_BASE = "/api/v1/avatars";

export type AvatarStatus = "draft" | "training" | "ready";

export interface Avatar {
  _id: string;
  userId: string;
  name: string;
  heroImageUrl?: string;
  masterVideoUrl?: string;
  description?: string;
  status: AvatarStatus;
  photoUrls: string[];
  voiceSampleUrls: string[];
  voiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAvatarPayload {
  name: string;
  description?: string;
}

export interface UpdateAvatarPayload {
  name?: string;
  description?: string;
  status?: AvatarStatus;
  heroImageUrl?: string;
}

// ==================== AVATAR API ROUTES ====================

/**
 * GET /api/v1/avatars
 * Fetch all avatars belonging to the current user.
 */
export const listAvatars = async (): Promise<Avatar[]> => {
  try {
    const response: any = await api.get(AVATARS_BASE);
    if (response.success) {
      return response.data.avatars;
    }
    throw new Error(response.message || "Failed to fetch avatars");
  } catch (error) {
    handleApiError(error, "Failed to synchronize avatar list");
    throw error;
  }
};

/**
 * GET /api/v1/avatars/:id
 * Fetch a single avatar by ID.
 */
export const getAvatarById = async (id: string): Promise<Avatar> => {
  try {
    const response: any = await api.get(`${AVATARS_BASE}/${id}`);
    return response.data.avatar;
  } catch (error) {
    handleApiError(error, "Failed to retrieve neural node");
    throw error;
  }
};

/**
 * POST /api/v1/avatars
 * Create a new avatar shell.
 */
export const createAvatar = async (
  payload: CreateAvatarPayload,
): Promise<Avatar> => {
  try {
    toast.loading("Initializing neural draft...", loadingStyles);
    const response: any = await api.post(AVATARS_BASE, payload);

    toast.dismiss();
    if (response.success) {
      toast.success("Identity initialized successfully", successStyles);
      return response.data.avatar;
    }
    throw new Error(response.message || "Creation failed");
  } catch (error) {
    toast.dismiss();
    handleApiError(error, "Avatar initialization failed");
    throw error;
  }
};

/**
 * PATCH /api/v1/avatars/:id
 * Update avatar metadata or status.
 */
export const updateAvatar = async (
  id: string,
  payload: UpdateAvatarPayload,
): Promise<Avatar> => {
  try {
    toast.loading("Updating neural parameters...", loadingStyles);
    const response: any = await api.patch(`${AVATARS_BASE}/${id}`, payload);

    toast.dismiss();
    if (response.success) {
      toast.success("Identity recalibrated", successStyles);
      return response.data.avatar;
    }
    throw new Error(response.message || "Update failed");
  } catch (error) {
    toast.dismiss();
    handleApiError(error);
    throw error;
  }
};

/**
 * DELETE /api/v1/avatars/:id
 * Terminate a digital twin and clean up assets.
 */
export const deleteAvatar = async (id: string): Promise<void> => {
  try {
    toast.loading("Terminating digital twin...", loadingStyles);
    const response: any = await api.delete(`${AVATARS_BASE}/${id}`);

    toast.dismiss();
    if (response.success) {
      toast.success("Identity purged from directory", successStyles);
    }
  } catch (error) {
    toast.dismiss();
    handleApiError(error, "Termination protocol failed");
    throw error;
  }
};

/**
 * POST /api/v1/avatars/:id/clone-voice
 * Trigger ElevenLabs voice cloning.
 */
export const cloneAvatarVoice = async (id: string): Promise<string> => {
  try {
    toast.loading("Cloning vocal signature...", loadingStyles);
    const response: any = await api.post(`${AVATARS_BASE}/${id}/clone-voice`);

    toast.dismiss();
    if (response.success) {
      toast.success("Vocal clone successful", successStyles);
      return response.data.voiceId;
    }
    throw new Error(response.message || "Cloning failed");
  } catch (error) {
    toast.dismiss();
    handleApiError(error, "Voice cloning failed");
    throw error;
  }
};

/**
 * POST /api/v1/avatars/:id/upload
 * Fixed to correctly append multiple files to FormData
 */
export const uploadAvatarAssets = async (
  id: string,
  files: { photos?: File[]; voiceSamples?: File[] },
): Promise<any> => {
  try {
    toast.loading("Uploading neural assets...", loadingStyles);

    const form = new FormData();

    // Loop through photos array and append each individually
    if (files.photos && files.photos.length > 0) {
      files.photos.forEach((file) => {
        form.append("photo", file); // Must match backend multer field name
      });
    }

    // Loop through voiceSamples array and append each individually
    if (files.voiceSamples && files.voiceSamples.length > 0) {
      files.voiceSamples.forEach((file) => {
        form.append("voiceSample", file); // Must match backend multer field name
      });
    }

    // IMPORTANT: When sending FormData via Axios/Fetch, do NOT manually set Content-Type.
    // The browser needs to set the boundary automatically.
    const response: any = await api.post(`${AVATARS_BASE}/${id}/upload`, form);

    toast.dismiss();
    if (response.success) {
      toast.success("Assets synchronized", successStyles);
      return response.data;
    }
    throw new Error(response.message || "Upload failed");
  } catch (error) {
    toast.dismiss();
    handleApiError(error, "Asset synchronization failed");
    throw error;
  }
};

export const testAvatarSpeech = async (
  voiceId: string,
  text: string,
): Promise<Blob> => {
  try {
    toast.loading("Generating neural audio...", loadingStyles);
    const response: any = await api.post(
      `${AVATARS_BASE}/test-speech`,
      { voiceId, text },
      { responseType: "blob" }, // Crucial for receiving audio files
    );
    toast.dismiss();
    return response; // This returns the audio binary (Blob)
  } catch (error) {
    toast.dismiss();
    handleApiError(error, "Speech generation failed");
    throw error;
  }
};

// ... existing imports

/**
 * POST /api/v1/avatars/:id/remove-asset
 * Removes a photo or voice sample from the avatar's identity matrix.
 */
export const removeAvatarAsset = async (
  id: string,
  payload: { url: string; type: "photo" | "voice" },
): Promise<Avatar> => {
  try {
    const response: any = await api.post(
      `${AVATARS_BASE}/${id}/remove-asset`,
      payload,
    );
    if (response.success) {
      return response.avatar;
    }
    throw new Error(response.message || "Removal failed");
  } catch (error) {
    handleApiError(error, "Asset purging failed");
    throw error;
  }
};

/**
 * POST /api/v1/avatars/:id/set-hero
 * Sets a specific uploaded photo as the Cloudinary-synced Hero Image.
 */
export const setAvatarHeroImage = async (
  id: string,
  url: string,
): Promise<{ success: boolean; heroImageUrl: string }> => {
  try {
    const response: any = await api.post(`${AVATARS_BASE}/${id}/set-hero`, {
      url,
    });
    return response.data;
  } catch (error) {
    handleApiError(error, "Hero synchronization failed");
    throw error;
  }
};
