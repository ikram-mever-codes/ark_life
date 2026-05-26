import { api, handleApiError } from "../utils/api";

export interface ChatMessage {
  _id: string;
  role: "user" | "avatar";
  text: string;
  createdAt: string;
}

export interface ChatResponse {
  reply: string;
  voiceId: string;
  avatarName: string;
}

/** * GET /api/v1/chat/history/:avatarId
 * Retrieves the last 50 messages for this specific digital twin.
 */
export const getChatHistory = async (
  avatarId: string,
): Promise<ChatMessage[]> => {
  try {
    const response: any = await api.get(`/api/v1/chat/history/${avatarId}`);
    if (response.success) {
      return response.data;
    }
    throw new Error(response.message || "Failed to sync history");
  } catch (error) {
    handleApiError(error, "Neural log retrieval failed");
    throw error;
  }
};

/** * POST /api/v1/chat
 * Sends user message and retrieves AI text reply + vocal metadata
 */
export const sendMessageToAvatar = async (
  avatarId: string,
  message: string,
): Promise<ChatResponse> => {
  try {
    const response: any = await api.post("/api/v1/chat", { avatarId, message });
    // Assuming your controller returns { success: true, data: { reply, voiceId... } }
    return response;
  } catch (error) {
    handleApiError(error, "Communication link failed");
    throw error;
  }
};
