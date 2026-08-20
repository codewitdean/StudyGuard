import { requestJson } from "./authApi.js";

function getWeeklyAvailabilityPath(filters = {}) {
  const params = new URLSearchParams();

  if (filters.weekday && filters.weekday !== "all") {
    params.set("weekday", filters.weekday);
  }

  const queryString = params.toString();
  return queryString
    ? "/api/availability/weekly?" + queryString
    : "/api/availability/weekly";
}

function getAvailabilityExceptionsPath(filters = {}) {
  const params = new URLSearchParams();

  if (filters.from) {
    params.set("from", filters.from);
  }

  if (filters.to) {
    params.set("to", filters.to);
  }

  if (filters.type && filters.type !== "all") {
    params.set("type", filters.type);
  }

  const queryString = params.toString();
  return queryString
    ? "/api/availability/exceptions?" + queryString
    : "/api/availability/exceptions";
}

export function listWeeklyAvailability(token, filters = {}) {
  return requestJson(getWeeklyAvailabilityPath(filters), {
    token,
  });
}

export function createWeeklyAvailability(token, availabilityWindow) {
  return requestJson("/api/availability/weekly", {
    method: "POST",
    body: availabilityWindow,
    token,
  });
}

export function getWeeklyAvailability(token, availabilityWindowId) {
  return requestJson("/api/availability/weekly/" + availabilityWindowId, {
    token,
  });
}

export function updateWeeklyAvailability(
  token,
  availabilityWindowId,
  availabilityWindow,
) {
  return requestJson("/api/availability/weekly/" + availabilityWindowId, {
    method: "PATCH",
    body: availabilityWindow,
    token,
  });
}

export function deleteWeeklyAvailability(token, availabilityWindowId) {
  return requestJson("/api/availability/weekly/" + availabilityWindowId, {
    method: "DELETE",
    token,
  });
}

export function listAvailabilityExceptions(token, filters = {}) {
  return requestJson(getAvailabilityExceptionsPath(filters), {
    token,
  });
}

export function createAvailabilityException(token, availabilityException) {
  return requestJson("/api/availability/exceptions", {
    method: "POST",
    body: availabilityException,
    token,
  });
}

export function getAvailabilityException(token, availabilityExceptionId) {
  return requestJson(
    "/api/availability/exceptions/" + availabilityExceptionId,
    {
      token,
    },
  );
}

export function updateAvailabilityException(
  token,
  availabilityExceptionId,
  availabilityException,
) {
  return requestJson(
    "/api/availability/exceptions/" + availabilityExceptionId,
    {
      method: "PATCH",
      body: availabilityException,
      token,
    },
  );
}

export function deleteAvailabilityException(token, availabilityExceptionId) {
  return requestJson(
    "/api/availability/exceptions/" + availabilityExceptionId,
    {
      method: "DELETE",
      token,
    },
  );
}
