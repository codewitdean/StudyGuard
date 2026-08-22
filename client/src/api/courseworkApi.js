import { ApiError, apiBaseUrl, requestJson } from "./authApi.js";

function getErrorMessage(payload, statusCode) {
  const firstDetail = payload?.error?.details?.[0];

  if (firstDetail) {
    return firstDetail.message;
  }

  return (
    payload?.error?.message ?? "Request failed with status " + statusCode + "."
  );
}

async function requestMultipart(path, { body, token }) {
  const headers = {};

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  let response;

  try {
    response = await fetch(apiBaseUrl + path, {
      method: "POST",
      headers,
      body,
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

function getCourseworkPath(filters = {}) {
  const params = new URLSearchParams();

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.courseId && filters.courseId !== "all") {
    params.set("courseId", filters.courseId);
  }

  if (filters.type && filters.type !== "all") {
    params.set("type", filters.type);
  }

  if (filters.due) {
    params.set("due", filters.due);
  }

  if (filters.sort) {
    params.set("sort", filters.sort);
  }

  const queryString = params.toString();
  return queryString ? "/api/coursework?" + queryString : "/api/coursework";
}

export function listCoursework(token, filters = {}) {
  return requestJson(getCourseworkPath(filters), {
    token,
  });
}

export function createCoursework(token, coursework) {
  return requestJson("/api/coursework", {
    method: "POST",
    body: coursework,
    token,
  });
}

export function getCoursework(token, courseworkId) {
  return requestJson("/api/coursework/" + courseworkId, {
    token,
  });
}

export function updateCoursework(token, courseworkId, coursework) {
  return requestJson("/api/coursework/" + courseworkId, {
    method: "PATCH",
    body: coursework,
    token,
  });
}

export function deleteCoursework(token, courseworkId) {
  return requestJson("/api/coursework/" + courseworkId, {
    method: "DELETE",
    token,
  });
}

export function previewSyllabusCoursework(token, syllabusData) {
  return requestJson("/api/coursework/syllabus/preview", {
    method: "POST",
    body: syllabusData,
    token,
  });
}

export function importSyllabusCoursework(token, syllabusImport) {
  return requestJson("/api/coursework/syllabus/import", {
    method: "POST",
    body: syllabusImport,
    token,
  });
}

export function previewUploadedSyllabusCoursework(token, formData) {
  return requestMultipart("/api/coursework/syllabus/upload-preview", {
    body: formData,
    token,
  });
}
