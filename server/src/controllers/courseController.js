import {
  createCourseForUser,
  deleteCourseForUser,
  getCourseForUser,
  listCoursesForUser,
  updateCourseForUser,
} from "../services/courseService.js";

export async function listCourses(req, res) {
  const courses = await listCoursesForUser(
    req.user.id,
    req.validated.query.status,
  );

  res.status(200).json({
    success: true,
    data: {
      courses,
    },
  });
}

export async function createCourse(req, res) {
  const course = await createCourseForUser(req.user.id, req.validated.body);

  res.status(201).json({
    success: true,
    data: {
      course,
    },
  });
}

export async function getCourse(req, res) {
  const course = await getCourseForUser(
    req.user.id,
    req.validated.params.courseId,
  );

  res.status(200).json({
    success: true,
    data: {
      course,
    },
  });
}

export async function updateCourse(req, res) {
  const course = await updateCourseForUser(
    req.user.id,
    req.validated.params.courseId,
    req.validated.body,
  );

  res.status(200).json({
    success: true,
    data: {
      course,
    },
  });
}

export async function deleteCourse(req, res) {
  await deleteCourseForUser(req.user.id, req.validated.params.courseId);

  res.status(204).send();
}
