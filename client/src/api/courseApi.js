import { requestJson } from "./authApi.js";

function getCoursesPath(status) {
  const params = new URLSearchParams();

  if (status) {
    params.set("status", status);
  }

  const queryString = params.toString();
  return queryString ? "/api/courses?" + queryString : "/api/courses";
}

export function listCourses(token, status = "active") {
  return requestJson(getCoursesPath(status), {
    token,
  });
}

export function createCourse(token, course) {
  return requestJson("/api/courses", {
    method: "POST",
    body: course,
    token,
  });
}

export function updateCourse(token, courseId, course) {
  return requestJson("/api/courses/" + courseId, {
    method: "PATCH",
    body: course,
    token,
  });
}

export function deleteCourse(token, courseId) {
  return requestJson("/api/courses/" + courseId, {
    method: "DELETE",
    token,
  });
}
