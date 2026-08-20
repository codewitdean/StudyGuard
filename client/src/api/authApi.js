const defaultApiBaseUrl = "http://127.0.0.1:4000";

export const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, { statusCode, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details ?? [];
  }
}

function getErrorMessage(payload, statusCode) {
  const firstDetail = payload?.error?.details?.[0];

  if (firstDetail) {
    return firstDetail.message;
  }

  return (
    payload?.error?.message ?? "Request failed with status " + statusCode + "."
  );
}

export async function requestJson(path, { method = "GET", body, token } = {}) {
  const headers = {};

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  let response;

  try {
    response = await fetch(apiBaseUrl + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach StudyGuard API at " + apiBaseUrl + ".");
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(payload, response.status), {
      statusCode: response.status,
      details: payload?.error?.details,
    });
  }

  return payload?.data ?? null;
}

export function registerStudent({ name, email, password }) {
  return requestJson("/api/auth/register", {
    method: "POST",
    body: { name, email, password },
  });
}

export function loginStudent({ email, password }) {
  return requestJson("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function getCurrentStudent(token) {
  return requestJson("/api/auth/me", {
    token,
  });
}
