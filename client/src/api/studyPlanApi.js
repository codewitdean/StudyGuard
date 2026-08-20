import { requestJson } from "./authApi.js";

function getStudyPlansPath(filters = {}) {
  const params = new URLSearchParams();

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.from) {
    params.set("from", filters.from);
  }

  if (filters.to) {
    params.set("to", filters.to);
  }

  const queryString = params.toString();
  return queryString ? "/api/study-plans?" + queryString : "/api/study-plans";
}

export function listStudyPlans(token, filters = {}) {
  return requestJson(getStudyPlansPath(filters), {
    token,
  });
}

export function generateStudyPlan(token, options = {}) {
  return requestJson("/api/study-plans/generate", {
    method: "POST",
    body: options,
    token,
  });
}

export function getStudyPlan(token, studyPlanId) {
  return requestJson("/api/study-plans/" + studyPlanId, {
    token,
  });
}

export function approveStudyPlan(token, studyPlanId) {
  return requestJson("/api/study-plans/" + studyPlanId + "/approve", {
    method: "POST",
    token,
  });
}

export function archiveStudyPlan(token, studyPlanId) {
  return requestJson("/api/study-plans/" + studyPlanId + "/archive", {
    method: "POST",
    token,
  });
}
