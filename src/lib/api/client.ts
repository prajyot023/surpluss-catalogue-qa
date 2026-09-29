import axios, { AxiosError } from "axios";

export class ApiError extends Error {
  status: number | null;
  fieldErrors?: Record<string, string[]>;
  /** Full response body, for routes that return extra context (e.g. incompleteProducts). */
  data?: unknown;

  constructor(
    message: string,
    status: number | null,
    fieldErrors?: Record<string, string[]>,
    data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.data = data;
  }
}

function messageForStatus(status: number) {
  if (status === 401) return "You need to sign in again.";
  if (status === 403) return "You don't have access to do that.";
  if (status === 404) return "That record no longer exists.";
  if (status >= 500) return "Something went wrong on the server. Please try again.";
  return "Please try again in a moment.";
}

export const apiClient = axios.create({
  timeout: 15_000,
  headers: { Accept: "application/json" },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; fieldErrors?: Record<string, string[]> }>;
      const status = axiosError.response?.status ?? null;

      if (status === 401 && typeof window !== "undefined") {
        window.location.assign("/login");
      }

      if (status !== null) {
        // Routes normally answer { error }, but framework errors can be non-JSON.
        const data = axiosError.response?.data;
        const message =
          data && typeof data === "object" && typeof data.error === "string"
            ? data.error
            : messageForStatus(status);
        const fieldErrors = data && typeof data === "object" ? data.fieldErrors : undefined;
        throw new ApiError(message, status, fieldErrors, data);
      }

      if (axiosError.code === "ECONNABORTED") {
        throw new ApiError("The request timed out. Check your connection and try again.", null);
      }
      throw new ApiError("Check your connection and try again.", null);
    }
    throw error;
  },
);

export function getApiErrorMessage(error: unknown, fallback = "Please try again in a moment.") {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
