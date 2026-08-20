import { query } from "../database/db.js";
import { badRequest, notFound } from "../utils/httpErrors.js";

const courseworkNotFoundMessage = "Coursework item not found.";
const courseNotFoundMessage = "Course not found.";

const courseworkSelectColumns = `
  cw.id,
  cw.course_id,
  cw.title,
  cw.description,
  cw.type,
  cw.due_at,
  cw.priority,
  cw.difficulty,
  cw.estimated_minutes,
  cw.status,
  cw.grade_weight,
  cw.topic,
  cw.notes,
  cw.completed_at,
  cw.created_at,
  cw.updated_at,
  c.id AS course_summary_id,
  c.name AS course_name,
  c.code AS course_code,
  c.color AS course_color
`;

const nullableUpdateColumnsByField = {
  courseId: "course_id",
  description: "description",
  dueAt: "due_at",
  gradeWeight: "grade_weight",
  topic: "topic",
  notes: "notes",
};

const requiredUpdateColumnsByField = {
  title: "title",
  type: "type",
  priority: "priority",
  difficulty: "difficulty",
  estimatedMinutes: "estimated_minutes",
};

function mapCourseSummary(row) {
  if (!row.course_summary_id) {
    return null;
  }

  return {
    id: row.course_summary_id,
    name: row.course_name,
    code: row.course_code,
    color: row.course_color,
  };
}

function mapCourseworkRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    course: mapCourseSummary(row),
    title: row.title,
    description: row.description,
    type: row.type,
    dueAt: row.due_at,
    priority: row.priority,
    difficulty: row.difficulty,
    estimatedMinutes: row.estimated_minutes,
    status: row.status,
    gradeWeight: row.grade_weight === null ? null : Number(row.grade_weight),
    topic: row.topic,
    notes: row.notes,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeOptionalValue(value) {
  return value ?? null;
}

function throwCourseworkNotFound() {
  throw notFound(courseworkNotFoundMessage);
}

function throwCourseNotFound() {
  throw notFound(courseNotFoundMessage);
}

async function ensureCourseBelongsToUser(userId, courseId) {
  if (courseId === undefined || courseId === null) {
    return;
  }

  const result = await query(
    `
      SELECT id
      FROM courses
      WHERE id = $1 AND user_id = $2;
    `,
    [courseId, userId],
  );

  if (result.rowCount === 0) {
    throwCourseNotFound();
  }
}

function getSortClause(sort) {
  if (sort === "createdNewest") {
    return "cw.created_at DESC";
  }

  if (sort === "effortHigh") {
    return "cw.estimated_minutes DESC, cw.due_at ASC NULLS LAST, cw.created_at DESC";
  }

  return "cw.due_at ASC NULLS LAST, cw.created_at DESC";
}

export async function listCourseworkForUser(userId, filters = {}) {
  const conditions = ["cw.user_id = $1"];
  const params = [userId];

  if (filters.status === "open") {
    conditions.push("cw.status IN ('not_started', 'in_progress', 'postponed')");
  } else if (filters.status !== "all") {
    params.push(filters.status);
    conditions.push(`cw.status = $${params.length}`);
  }

  if (filters.courseId) {
    params.push(filters.courseId);
    conditions.push(`cw.course_id = $${params.length}`);
  }

  if (filters.type) {
    params.push(filters.type);
    conditions.push(`cw.type = $${params.length}`);
  }

  if (filters.due === "upcoming") {
    conditions.push("cw.due_at IS NOT NULL AND cw.due_at >= now()");
  }

  if (filters.due === "overdue") {
    conditions.push("cw.due_at IS NOT NULL AND cw.due_at < now()");
  }

  if (filters.due === "no_due_date") {
    conditions.push("cw.due_at IS NULL");
  }

  const result = await query(
    `
      SELECT ${courseworkSelectColumns}
      FROM coursework cw
      LEFT JOIN courses c ON c.id = cw.course_id AND c.user_id = cw.user_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${getSortClause(filters.sort)};
    `,
    params,
  );

  return result.rows.map(mapCourseworkRow);
}

export async function createCourseworkForUser(userId, courseworkData) {
  await ensureCourseBelongsToUser(userId, courseworkData.courseId);

  const result = await query(
    `
      INSERT INTO coursework (
        user_id,
        course_id,
        title,
        description,
        type,
        due_at,
        priority,
        difficulty,
        estimated_minutes,
        grade_weight,
        topic,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id;
    `,
    [
      userId,
      normalizeOptionalValue(courseworkData.courseId),
      courseworkData.title,
      normalizeOptionalValue(courseworkData.description),
      courseworkData.type,
      normalizeOptionalValue(courseworkData.dueAt),
      courseworkData.priority,
      courseworkData.difficulty,
      courseworkData.estimatedMinutes,
      normalizeOptionalValue(courseworkData.gradeWeight),
      normalizeOptionalValue(courseworkData.topic),
      normalizeOptionalValue(courseworkData.notes),
    ],
  );

  return getCourseworkForUser(userId, result.rows[0].id);
}

export async function getCourseworkForUser(userId, courseworkId) {
  const result = await query(
    `
      SELECT ${courseworkSelectColumns}
      FROM coursework cw
      LEFT JOIN courses c ON c.id = cw.course_id AND c.user_id = cw.user_id
      WHERE cw.id = $1 AND cw.user_id = $2;
    `,
    [courseworkId, userId],
  );

  const courseworkItem = result.rows[0];

  if (!courseworkItem) {
    throwCourseworkNotFound();
  }

  return mapCourseworkRow(courseworkItem);
}

export async function updateCourseworkForUser(
  userId,
  courseworkId,
  courseworkData,
) {
  if (Object.hasOwn(courseworkData, "courseId")) {
    await ensureCourseBelongsToUser(userId, courseworkData.courseId);
  }

  const assignments = [];
  const params = [];

  for (const [field, column] of Object.entries(nullableUpdateColumnsByField)) {
    if (!Object.hasOwn(courseworkData, field)) {
      continue;
    }

    params.push(normalizeOptionalValue(courseworkData[field]));
    assignments.push(`${column} = $${params.length}`);
  }

  for (const [field, column] of Object.entries(requiredUpdateColumnsByField)) {
    if (!Object.hasOwn(courseworkData, field)) {
      continue;
    }

    params.push(courseworkData[field]);
    assignments.push(`${column} = $${params.length}`);
  }

  if (Object.hasOwn(courseworkData, "status")) {
    params.push(courseworkData.status);
    assignments.push(`status = $${params.length}`);
    assignments.push(
      courseworkData.status === "completed"
        ? "completed_at = COALESCE(completed_at, now())"
        : "completed_at = NULL",
    );
  }

  if (assignments.length === 0) {
    throw badRequest("At least one field must be provided.");
  }

  params.push(courseworkId);
  const courseworkIdParam = params.length;

  params.push(userId);
  const userIdParam = params.length;

  const result = await query(
    `
      UPDATE coursework
      SET ${assignments.join(", ")}
      WHERE id = $${courseworkIdParam} AND user_id = $${userIdParam}
      RETURNING id;
    `,
    params,
  );

  const updatedCourseworkItem = result.rows[0];

  if (!updatedCourseworkItem) {
    throwCourseworkNotFound();
  }

  return getCourseworkForUser(userId, updatedCourseworkItem.id);
}

export async function deleteCourseworkForUser(userId, courseworkId) {
  const result = await query(
    `
      DELETE FROM coursework
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `,
    [courseworkId, userId],
  );

  if (result.rowCount === 0) {
    throwCourseworkNotFound();
  }
}
