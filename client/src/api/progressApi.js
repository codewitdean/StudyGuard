import { requestJson } from "./authApi.js";

function getProgressSummaryPath(filters = {}) {
  const params = new URLSearchParams();

  if (filters.from) {
    params.set("from", filters.from);
  }

  if (filters.to) {
    params.set("to", filters.to);
  }

  if (filters.courseId) {
    params.set("courseId", filters.courseId);
  }

  if (filters.courseworkId) {
    params.set("courseworkId", filters.courseworkId);
  }

  const queryString = params.toString();
  return queryString
    ? "/api/progress/summary?" + queryString
    : "/api/progress/summary";
}

function getStudySessionsPath(filters = {}) {
  const params = new URLSearchParams();

  if (filters.from) {
    params.set("from", filters.from);
  }

  if (filters.to) {
    params.set("to", filters.to);
  }

  if (filters.courseworkId) {
    params.set("courseworkId", filters.courseworkId);
  }

  if (filters.studyBlockId) {
    params.set("studyBlockId", filters.studyBlockId);
  }

  if (filters.source && filters.source !== "all") {
    params.set("source", filters.source);
  }

  if (filters.limit) {
    params.set("limit", filters.limit);
  }

  const queryString = params.toString();
  return queryString
    ? "/api/progress/study-sessions?" + queryString
    : "/api/progress/study-sessions";
}

export function getProgressSummary(token, filters = {}) {
  return requestJson(getProgressSummaryPath(filters), {
    token,
  });
}

export function listStudySessions(token, filters = {}) {
  return requestJson(getStudySessionsPath(filters), {
    token,
  });
}

export function createStudySession(token, studySession) {
  return requestJson("/api/progress/study-sessions", {
    method: "POST",
    body: studySession,
    token,
  });
}

export function updateStudySession(token, studySessionId, studySession) {
  return requestJson("/api/progress/study-sessions/" + studySessionId, {
    method: "PATCH",
    body: studySession,
    token,
  });
}

export function deleteStudySession(token, studySessionId) {
  return requestJson("/api/progress/study-sessions/" + studySessionId, {
    method: "DELETE",
    token,
  });
}
