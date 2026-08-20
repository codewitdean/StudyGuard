import { requestJson } from "./authApi.js";

function getRecommendationsPath(filters = {}) {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "review") {
    params.set("status", filters.status);
  }

  if (filters.type && filters.type !== "all") {
    params.set("type", filters.type);
  }

  if (filters.courseworkId) {
    params.set("courseworkId", filters.courseworkId);
  }

  if (filters.studyBlockId) {
    params.set("studyBlockId", filters.studyBlockId);
  }

  const queryString = params.toString();
  return queryString
    ? "/api/recommendations?" + queryString
    : "/api/recommendations";
}

export function listRecommendations(token, filters = {}) {
  return requestJson(getRecommendationsPath(filters), {
    token,
  });
}

export function createRecommendation(token, recommendation) {
  return requestJson("/api/recommendations", {
    method: "POST",
    body: recommendation,
    token,
  });
}

export function editRecommendation(token, recommendationId, editedChange) {
  return requestJson("/api/recommendations/" + recommendationId, {
    method: "PATCH",
    body: { editedChange },
    token,
  });
}

export function approveRecommendation(token, recommendationId) {
  return requestJson("/api/recommendations/" + recommendationId + "/approve", {
    method: "POST",
    token,
  });
}

export function rejectRecommendation(token, recommendationId) {
  return requestJson("/api/recommendations/" + recommendationId + "/reject", {
    method: "POST",
    token,
  });
}

export function deleteRecommendation(token, recommendationId) {
  return requestJson("/api/recommendations/" + recommendationId, {
    method: "DELETE",
    token,
  });
}
