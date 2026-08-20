import { query } from "../database/db.js";
import { badRequest, notFound } from "../utils/httpErrors.js";

const courseNotFoundMessage = "Course not found.";

const courseSelectColumns = `
  id,
  name,
  code,
  instructor,
  color,
  term,
  target_grade,
  is_archived,
  created_at,
  updated_at
`;

const updateColumnsByField = {
  name: "name",
  code: "code",
  instructor: "instructor",
  color: "color",
  term: "term",
  targetGrade: "target_grade",
  isArchived: "is_archived",
};

function mapCourseRow(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    instructor: row.instructor,
    color: row.color,
    term: row.term,
    targetGrade: row.target_grade,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeOptionalValue(value) {
  return value ?? null;
}

function throwCourseNotFound() {
  throw notFound(courseNotFoundMessage);
}

export async function listCoursesForUser(userId, status = "active") {
  const conditions = ["user_id = $1"];
  const params = [userId];

  if (status === "active") {
    conditions.push("is_archived = false");
  }

  if (status === "archived") {
    conditions.push("is_archived = true");
  }

  const result = await query(
    `
      SELECT ${courseSelectColumns}
      FROM courses
      WHERE ${conditions.join(" AND ")}
      ORDER BY is_archived ASC, name ASC, created_at DESC;
    `,
    params,
  );

  return result.rows.map(mapCourseRow);
}

export async function createCourseForUser(userId, courseData) {
  const result = await query(
    `
      INSERT INTO courses (user_id, name, code, instructor, color, term, target_grade)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${courseSelectColumns};
    `,
    [
      userId,
      courseData.name,
      normalizeOptionalValue(courseData.code),
      normalizeOptionalValue(courseData.instructor),
      normalizeOptionalValue(courseData.color),
      normalizeOptionalValue(courseData.term),
      normalizeOptionalValue(courseData.targetGrade),
    ],
  );

  return mapCourseRow(result.rows[0]);
}

export async function getCourseForUser(userId, courseId) {
  const result = await query(
    `
      SELECT ${courseSelectColumns}
      FROM courses
      WHERE id = $1 AND user_id = $2;
    `,
    [courseId, userId],
  );

  const course = result.rows[0];

  if (!course) {
    throwCourseNotFound();
  }

  return mapCourseRow(course);
}

export async function updateCourseForUser(userId, courseId, courseData) {
  const assignments = [];
  const params = [];

  for (const [field, column] of Object.entries(updateColumnsByField)) {
    if (!Object.hasOwn(courseData, field)) {
      continue;
    }

    params.push(courseData[field]);
    assignments.push(`${column} = $${params.length}`);
  }

  if (assignments.length === 0) {
    throw badRequest("At least one field must be provided.");
  }

  params.push(courseId);
  const courseIdParam = params.length;

  params.push(userId);
  const userIdParam = params.length;

  const result = await query(
    `
      UPDATE courses
      SET ${assignments.join(", ")}
      WHERE id = $${courseIdParam} AND user_id = $${userIdParam}
      RETURNING ${courseSelectColumns};
    `,
    params,
  );

  const course = result.rows[0];

  if (!course) {
    throwCourseNotFound();
  }

  return mapCourseRow(course);
}

export async function deleteCourseForUser(userId, courseId) {
  const result = await query(
    `
      DELETE FROM courses
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `,
    [courseId, userId],
  );

  if (result.rowCount === 0) {
    throwCourseNotFound();
  }
}
