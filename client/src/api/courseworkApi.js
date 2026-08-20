import { requestJson } from "./authApi.js";

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
