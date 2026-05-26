import axios from "axios";
import { errorStyles, BASE_URL } from "./constants";
import { toast } from "react-hot-toast";

// Helper to get token safely in client-side
const getAccessToken = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("access_token");
  }
  return null;
};

export const handleApiError = (error: unknown, defaultMessage?: string) => {
  toast.dismiss();
  if (axios.isAxiosError(error)) {
    toast.error(error.response?.data?.message || error.message, errorStyles);
  } else if (error instanceof Error) {
    toast.error(error.message, errorStyles);
  } else {
    toast.error(defaultMessage || "Unexpected Error", errorStyles);
  }
  console.error(error);
};

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 100000,
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Check if we are sending files
    if (config.data instanceof FormData) {
      // We MUST delete this so the browser sets the boundary automatically
      if (config.headers["Content-Type"]) {
        delete config.headers["Content-Type"];
      }
    } else {
      // Standard JSON request
      config.headers["Content-Type"] = "application/json";
    }

    // IMPORTANT: You must return the config!
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error: any) => {
    if (error.response) {
      // Don't show toast for 401s if you're handling them in AuthProvider
      if (error.response.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          window.location.href = "/login";
        }
      } else {
        toast.error(error.response.data?.message || error.message, errorStyles);
      }
    }
    return Promise.reject(error);
  },
);

// --- UPDATED: sendRequest (Fetch) ---
export const sendRequest = (
  url: string,
  success: (data?: any) => void,
  failure: (data?: any) => void,
  method: string,
  payload?: any,
  useToken: boolean = true, // Default to true now
  beforeMakingCall?: () => void,
  final?: () => void,
  formData?: boolean,
) => {
  if (typeof window !== "undefined" && !window.navigator.onLine) return;

  const token = getAccessToken();

  const headers: HeadersInit = {
    ...(formData ? {} : { "Content-Type": "application/json" }),
    ...(useToken && token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const info: RequestInit = {
    method: method,
    headers: headers,
    ...(payload && method !== "GET"
      ? { body: formData ? payload : JSON.stringify(payload) }
      : {}),
  };

  beforeMakingCall?.();
  const APIURL = url.startsWith("http") ? url : `${BASE_URL}${url}`;

  fetch(APIURL, info)
    .then(async (resp: Response) => {
      let jsonData: any = null;
      const contentType = resp.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        jsonData = await resp.json();
      }

      if (resp.ok) {
        return success?.(jsonData);
      }

      if (resp.status === 401) {
        window.location.href = "/login";
      }

      throw new Error(jsonData?.message || "Request failed");
    })
    .catch((err) => {
      failure?.(err?.message || "An error occurred");
    })
    .finally(() => {
      final?.();
    });
};
