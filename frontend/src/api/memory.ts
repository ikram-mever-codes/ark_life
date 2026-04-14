import { api, handleApiError } from "../utils/api";
import { toast } from "react-hot-toast";
import { loadingStyles, successStyles } from "@/utils/constants";

const MEMORY_BASE = "/api/v1/memory";

export interface MemoryVaultFile {
  _id: string;
  fileName: string;
  fileType: string;
  uploadDate: string;
  isIndexed: boolean;
}

export interface VaultData {
  _id: string;
  neuralBio?: string;
  files: MemoryVaultFile[];
  vectorConfig: {
    isIndexed: boolean;
    lastIndexedAt?: string;
  };
}

/** Get the current user's central Memory Vault */
export const getVault = async (): Promise<VaultData> => {
  try {
    const response: any = await api.get(`${MEMORY_BASE}/vault`);
    return response.data.vault;
  } catch (error) {
    handleApiError(error, "Failed to load memory vault");
    throw error;
  }
};

// api/memory.ts
export const addMemory = async (payload: {
  file?: File;
  neuralBio?: string;
  avatarId?: string; // Added avatarId
}): Promise<any> => {
  const form = new FormData();
  if (payload.file) form.append("file", payload.file);
  if (payload.neuralBio) form.append("neuralBio", payload.neuralBio);
  if (payload.avatarId) form.append("avatarId", payload.avatarId); // Append to form

  const response: any = await api.post(`${MEMORY_BASE}/add-memory`, form);
  return response.data;
};

export const deleteMemoryFile = async (fileId: string): Promise<void> => {
  try {
    toast.loading("Purging memory fragment...", loadingStyles);
    await api.delete(`${MEMORY_BASE}/files/${fileId}`);
    toast.dismiss();
    toast.success("Fragment purged successfully", successStyles);
  } catch (error) {
    toast.dismiss();
    handleApiError(error);
  }
};

/** Query the RAG system (Testing purpose) */
export const queryRag = async (query: string) => {
  try {
    const response: any = await api.get(`${MEMORY_BASE}/rag-query`, {
      params: { q: query },
    });
    return response.data.chunks;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};
