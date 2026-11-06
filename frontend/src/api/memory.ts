import { api, handleApiError } from "../utils/api";
import { toast } from "react-hot-toast";
import { loadingStyles, successStyles, BASE_URL } from "@/utils/constants";

const MEMORY_BASE = "/api/v1/memory";

export type DocumentStatus =
  | "processing"
  | "ocr_processing"
  | "indexed"
  | "failed";
export type DocumentCategory = "clinical" | "personal";
export type DocumentSource = "upload" | "fse";

export interface MemoryVaultFile {
  _id: string;
  fileName: string;
  fileType: string;
  uploadDate: string;
  isIndexed: boolean;
  status: DocumentStatus;
  indexError?: string | null;
  ocrUsed?: boolean;
  pageCount?: number;
  chunkCount?: number;
  sizeBytes?: number;
  category: DocumentCategory;
  source: DocumentSource;
  avatarId?: string | null;
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

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  processing: "Processing",
  ocr_processing: "OCR Processing",
  indexed: "Indexed",
  failed: "Failed",
};

export const isProcessing = (f: MemoryVaultFile) =>
  f.status === "processing" || f.status === "ocr_processing";

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

export const addMemory = async (payload: {
  file?: File;
  neuralBio?: string;
  avatarId?: string;
  category?: DocumentCategory;
  source?: DocumentSource;
}): Promise<any> => {
  const form = new FormData();
  if (payload.file) form.append("file", payload.file);
  if (payload.neuralBio) form.append("neuralBio", payload.neuralBio);
  if (payload.avatarId) form.append("avatarId", payload.avatarId);
  if (payload.category) form.append("category", payload.category);
  if (payload.source) form.append("source", payload.source);

  const response: any = await api.post(`${MEMORY_BASE}/add-memory`, form);
  return response.data;
};

export const deleteMemoryFile = async (fileId: string): Promise<void> => {
  try {
    toast.loading("Deleting document...", loadingStyles);
    await api.delete(`${MEMORY_BASE}/files/${fileId}`);
    toast.dismiss();
    toast.success("Document deleted", successStyles);
  } catch (error) {
    toast.dismiss();
    handleApiError(error);
  }
};

/** Restart processing of a failed document. */
export const retryMemoryFile = async (fileId: string): Promise<void> => {
  await api.post(`${MEMORY_BASE}/files/${fileId}/retry`);
};

/**
 * Download a document through the authenticated endpoint and return an
 * object URL for the in-app viewer. Caller must URL.revokeObjectURL() it.
 */
export const getFileObjectUrl = async (
  fileId: string,
): Promise<{ url: string; type: string }> => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const resp = await fetch(`${BASE_URL}${MEMORY_BASE}/files/${fileId}/content`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) throw new Error(`Could not open document (${resp.status})`);
  const blob = await resp.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
};

/** Extracted / OCR text of a document (what the AI reads). */
export const getFileText = async (
  fileId: string,
): Promise<{ text: string; ocrUsed: boolean }> => {
  const response: any = await api.get(`${MEMORY_BASE}/files/${fileId}/text`);
  return response.data;
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

/** Move a document between Clinical and personal memories. */
export const setFileCategory = async (
  fileId: string,
  category: DocumentCategory,
): Promise<void> => {
  await api.patch(`${MEMORY_BASE}/files/${fileId}`, { category });
};
