import { query } from "../database/db.js";
import { badRequest, notFound } from "../utils/httpErrors.js";

const studySessionNotFoundMessage = "Study session not found.";
const courseNotFoundMessage = "Course not found.";
const courseworkNotFoundMessage = "Coursework item not found.";
const studyBlockNotFoundMessage = "Study block not found.";

const studySessionSelectColumns = [
  "ss.id",
  "ss.coursework_id AS session_coursework_id",
  "ss.study_block_id AS session_study_block_id",
  "ss.source",
  "ss.started_at",
  "ss.ended_at",
  "ss.duration_minutes",
  "ss.notes",
  "ss.created_at",
  "ss.updated_at",
  "cw.id AS coursework_summary_id",
  "cw.title AS coursework_title",
  "cw.type AS coursework_type",
  "cw.due_at AS coursework_due_at",
  "cw.estimated_minutes AS coursework_estimated_minutes",
  "cw.status AS coursework_status",
  "c.id AS course_summary_id",
  "c.name AS course_name",
  "c.code AS course_code",
  "c.color AS course_color",
  "sb.id AS study_block_summary_id",
  "sb.study_plan_id AS study_block_plan_id",
  "sb.block_type AS study_block_type",
  "sb.start_at AS study_block_start_at",
  "sb.end_at AS study_block_end_at",
  "sb.status AS study_block_status",
].join(",\n  ");

const studySessionFromClause = [
  "FROM study_sessions ss",
  "LEFT JOIN study_blocks sb",
  "  ON sb.id = ss.study_block_id",
  "  AND sb.user_id = ss.user_id",
  "LEFT JOIN coursework cw",
  "  ON cw.id = COALESCE(ss.coursework_id, sb.coursework_id)",
  "  AND cw.user_id = ss.user_id",
  "LEFT JOIN courses c",
  "  ON c.id = cw.course_id",
  "  AND c.user_id = cw.user_id",
].join("\n");

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

function mapCourseworkSummary(row) {
  if (!row.coursework_summary_id) {
    return null;
  }

  return {
    id: row.coursework_summary_id,
    title: row.coursework_title,
    type: row.coursework_type,
    dueAt: row.coursework_due_at,
    estimatedMinutes: row.coursework_estimated_minutes,
    status: row.coursework_status,
    course: mapCourseSummary(row),
  };
}

function mapStudyBlockSummary(row) {
  if (!row.study_block_summary_id) {
    return null;
  }

  return {
    id: row.study_block_summary_id,
    studyPlanId: row.study_block_plan_id,
    blockType: row.study_block_type,
    startAt: row.study_block_start_at,
    endAt: row.study_block_end_at,
    status: row.study_block_status,
  };
}

function mapStudySessionRow(row) {
  return {
    id: row.id,
    courseworkId: row.session_coursework_id,
    studyBlockId: row.session_study_block_id,
    source: row.source,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMinutes: row.duration_minutes,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    coursework: mapCourseworkSummary(row),
    studyBlock: mapStudyBlockSummary(row),
  };
}

function normalizeOptionalValue(value) {
  return value ?? null;
}

function hasOwn(object, field) {
  return Object.hasOwn(object, field);
}

function throwStudySessionNotFound() {
  throw notFound(studySessionNotFoundMessage);
}

function throwCourseNotFound() {
  throw notFound(courseNotFoundMessage);
}

function throwCourseworkNotFound() {
  throw notFound(courseworkNotFoundMessage);
}

function throwStudyBlockNotFound() {
  throw notFound(studyBlockNotFoundMessage);
}

function getTodayDate() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(dateString + "T00:00:00");
  date.setDate(date.getDate() + days);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getCurrentWeekRange() {
  const today = getTodayDate();
  const date = new Date(today + "T00:00:00");
  const weekday = date.getDay();
  const mondayOffset = (weekday + 6) % 7;
  const monday = addDays(today, -mondayOffset);

  return {
    from: monday,
    to: addDays(monday, 6),
  };
}

function getProgressRange(filters = {}) {
  if (!filters.from && !filters.to) {
    return getCurrentWeekRange();
  }

  if (filters.from && !filters.to) {
    return {
      from: filters.from,
      to: filters.from,
    };
  }

  if (!filters.from && filters.to) {
    return {
      from: filters.to,
      to: filters.to,
    };
  }

  return {
    from: filters.from,
    to: filters.to,
  };
}

function addDateRangeConditions(conditions, params, column, range) {
  params.push(range.from);
  const fromParam = params.length;
  params.push(range.to);
  const toParam = params.length;

  conditions.push(`${column} >= $${fromParam}::date`);
  conditions.push(`${column} < ($${toParam}::date + INTERVAL '1 day')`);
}

function addCourseworkFilters(conditions, params, filters = {}, alias = "cw") {
  if (filters.courseId) {
    params.push(filters.courseId);
    conditions.push(`${alias}.course_id = $${params.length}`);
  }

  if (filters.courseworkId) {
    params.push(filters.courseworkId);
    conditions.push(`${alias}.id = $${params.length}`);
  }
}

function addStudySessionFilters(conditions, params, filters = {}) {
  if (filters.courseId) {
    params.push(filters.courseId);
    conditions.push(`cw.course_id = $${params.length}`);
  }

  if (filters.courseworkId) {
    params.push(filters.courseworkId);
    conditions.push(`cw.id = $${params.length}`);
  }

  if (filters.studyBlockId) {
    params.push(filters.studyBlockId);
    conditions.push(`ss.study_block_id = $${params.length}`);
  }

  if (filters.source) {
    params.push(filters.source);
    conditions.push(`ss.source = $${params.length}`);
  }
}

function getEstimateAccuracyLabel(
  comparedCourseworkCount,
  averageEstimated,
  averageActual,
) {
  if (!comparedCourseworkCount || !averageEstimated) {
    return "not_enough_data";
  }

  const ratio = averageActual / averageEstimated;

  if (ratio > 1.25) {
    return "taking_longer_than_estimated";
  }

  if (ratio < 0.75) {
    return "finishing_faster_than_estimated";
  }

  return "usually_close";
}

function assertTimestampOrder(startedAt, endedAt) {
  if (!startedAt || !endedAt) {
    return;
  }

  if (new Date(startedAt).getTime() >= new Date(endedAt).getTime()) {
    throw badRequest("startedAt must be before endedAt.");
  }
}

async function ensureCourseBelongsToUser(userId, courseId) {
  if (!courseId) {
    return;
  }

  const result = await query(
    ["SELECT id", "FROM courses", "WHERE id = $1 AND user_id = $2;"].join("\n"),
    [courseId, userId],
  );

  if (result.rowCount === 0) {
    throwCourseNotFound();
  }
}

async function ensureCourseworkBelongsToUser(userId, courseworkId) {
  if (!courseworkId) {
    return null;
  }

  const result = await query(
    [
      "SELECT id, course_id",
      "FROM coursework",
      "WHERE id = $1 AND user_id = $2;",
    ].join("\n"),
    [courseworkId, userId],
  );
  const coursework = result.rows[0];

  if (!coursework) {
    throwCourseworkNotFound();
  }

  return coursework;
}

async function ensureStudyBlockBelongsToUser(userId, studyBlockId) {
  if (!studyBlockId) {
    return null;
  }

  const result = await query(
    [
      "SELECT id, coursework_id",
      "FROM study_blocks",
      "WHERE id = $1 AND user_id = $2;",
    ].join("\n"),
    [studyBlockId, userId],
  );
  const studyBlock = result.rows[0];

  if (!studyBlock) {
    throwStudyBlockNotFound();
  }

  return studyBlock;
}

async function ensureStudySessionReferences(
  userId,
  courseworkId,
  studyBlockId,
) {
  await ensureCourseworkBelongsToUser(userId, courseworkId);
  const studyBlock = await ensureStudyBlockBelongsToUser(userId, studyBlockId);

  if (
    courseworkId &&
    studyBlock?.coursework_id &&
    studyBlock.coursework_id !== courseworkId
  ) {
    throw badRequest("Study block belongs to a different coursework item.");
  }
}

async function getStudySessionRecordForUser(userId, studySessionId) {
  const result = await query(
    [
      "SELECT id, coursework_id, study_block_id, source, started_at, ended_at, duration_minutes, notes",
      "FROM study_sessions",
      "WHERE id = $1 AND user_id = $2;",
    ].join("\n"),
    [studySessionId, userId],
  );
  const studySession = result.rows[0];

  if (!studySession) {
    throwStudySessionNotFound();
  }

  return studySession;
}

async function getTaskCounts(userId, range, filters = {}) {
  const conditions = ["cw.user_id = $1"];
  const params = [userId];
  addCourseworkFilters(conditions, params, filters);

  params.push(range.from);
  const fromParam = params.length;
  params.push(range.to);
  const toParam = params.length;

  const dateStart = `$${fromParam}::date`;
  const dateEnd = `($${toParam}::date + INTERVAL '1 day')`;

  const result = await query(
    [
      "SELECT",
      `  COUNT(*) FILTER (WHERE cw.status = 'completed' AND cw.completed_at >= ${dateStart} AND cw.completed_at < ${dateEnd})::int AS completed_count,`,
      `  COUNT(*) FILTER (WHERE cw.status = 'missed' AND cw.due_at >= ${dateStart} AND cw.due_at < ${dateEnd})::int AS missed_count,`,
      `  COUNT(*) FILTER (WHERE cw.status = 'postponed' AND cw.due_at >= ${dateStart} AND cw.due_at < ${dateEnd})::int AS postponed_count,`,
      `  COUNT(*) FILTER (WHERE cw.status IN ('not_started', 'in_progress') AND cw.due_at >= ${dateStart} AND cw.due_at < ${dateEnd})::int AS open_count,`,
      `  COUNT(*) FILTER (WHERE cw.status <> 'archived' AND cw.due_at >= ${dateStart} AND cw.due_at < ${dateEnd})::int AS total_due_count`,
      "FROM coursework cw",
      "WHERE " + conditions.join(" AND ") + ";",
    ].join("\n"),
    params,
  );
  const counts = result.rows[0];

  return {
    completed: counts.completed_count,
    missed: counts.missed_count,
    postponed: counts.postponed_count,
    open: counts.open_count,
    totalDue: counts.total_due_count,
  };
}

async function getStudyTimeSummary(userId, range, filters = {}) {
  const conditions = ["ss.user_id = $1"];
  const params = [userId];
  addDateRangeConditions(
    conditions,
    params,
    "COALESCE(ss.started_at, ss.created_at)",
    range,
  );
  addStudySessionFilters(conditions, params, filters);

  const result = await query(
    [
      "SELECT",
      "  COALESCE(SUM(ss.duration_minutes), 0)::int AS total_minutes,",
      "  COUNT(ss.id)::int AS session_count",
      studySessionFromClause,
      "WHERE " + conditions.join(" AND ") + ";",
    ].join("\n"),
    params,
  );
  const studyTime = result.rows[0];
  const totalMinutes = studyTime.total_minutes;
  const sessionCount = studyTime.session_count;

  return {
    totalMinutes,
    sessionCount,
    averageSessionMinutes:
      sessionCount === 0 ? 0 : Math.round(totalMinutes / sessionCount),
  };
}

async function getEstimateAccuracy(userId, range, filters = {}) {
  const conditions = [
    "cw.user_id = $1",
    "cw.status = 'completed'",
    "cw.completed_at >= $2::date",
    "cw.completed_at < ($3::date + INTERVAL '1 day')",
  ];
  const params = [userId, range.from, range.to];
  addCourseworkFilters(conditions, params, filters);

  const result = await query(
    [
      "WITH actuals AS (",
      "  SELECT",
      "    cw.id,",
      "    cw.estimated_minutes,",
      "    SUM(ss.duration_minutes)::int AS actual_minutes",
      "  FROM coursework cw",
      "  JOIN study_sessions ss",
      "    ON ss.user_id = cw.user_id",
      "  LEFT JOIN study_blocks sb",
      "    ON sb.id = ss.study_block_id",
      "    AND sb.user_id = ss.user_id",
      "  WHERE " + conditions.join(" AND "),
      "    AND (",
      "      ss.coursework_id = cw.id",
      "      OR (ss.coursework_id IS NULL AND sb.coursework_id = cw.id)",
      "    )",
      "  GROUP BY cw.id, cw.estimated_minutes",
      ")",
      "SELECT",
      "  COUNT(*)::int AS compared_coursework_count,",
      "  COALESCE(ROUND(AVG(estimated_minutes)), 0)::int AS average_estimated_minutes,",
      "  COALESCE(ROUND(AVG(actual_minutes)), 0)::int AS average_actual_minutes,",
      "  COALESCE(ROUND(AVG(actual_minutes - estimated_minutes)), 0)::int AS average_delta_minutes",
      "FROM actuals;",
    ].join("\n"),
    params,
  );
  const accuracy = result.rows[0];
  const comparedCourseworkCount = accuracy.compared_coursework_count;
  const averageEstimatedMinutes = accuracy.average_estimated_minutes;
  const averageActualMinutes = accuracy.average_actual_minutes;

  return {
    label: getEstimateAccuracyLabel(
      comparedCourseworkCount,
      averageEstimatedMinutes,
      averageActualMinutes,
    ),
    comparedCourseworkCount,
    averageEstimatedMinutes,
    averageActualMinutes,
    averageDeltaMinutes: accuracy.average_delta_minutes,
  };
}

export async function listStudySessionsForUser(userId, filters = {}) {
  const conditions = ["ss.user_id = $1"];
  const params = [userId];

  if (filters.from) {
    params.push(filters.from);
    conditions.push(
      `COALESCE(ss.started_at, ss.created_at) >= $${params.length}::date`,
    );
  }

  if (filters.to) {
    params.push(filters.to);
    conditions.push(
      `COALESCE(ss.started_at, ss.created_at) < ($${params.length}::date + INTERVAL '1 day')`,
    );
  }

  addStudySessionFilters(conditions, params, filters);
  params.push(filters.limit ?? 25);
  const limitParam = params.length;

  const result = await query(
    [
      "SELECT " + studySessionSelectColumns,
      studySessionFromClause,
      "WHERE " + conditions.join(" AND "),
      "ORDER BY COALESCE(ss.started_at, ss.created_at) DESC, ss.created_at DESC",
      "LIMIT $" + limitParam + ";",
    ].join("\n"),
    params,
  );

  return result.rows.map(mapStudySessionRow);
}

export async function getProgressSummaryForUser(userId, filters = {}) {
  const range = getProgressRange(filters);

  await ensureCourseBelongsToUser(userId, filters.courseId);
  await ensureCourseworkBelongsToUser(userId, filters.courseworkId);

  const [taskCounts, studyTime, estimateAccuracy, recentSessions] =
    await Promise.all([
      getTaskCounts(userId, range, filters),
      getStudyTimeSummary(userId, range, filters),
      getEstimateAccuracy(userId, range, filters),
      listStudySessionsForUser(userId, {
        ...filters,
        from: range.from,
        to: range.to,
        limit: 5,
      }),
    ]);

  return {
    range,
    taskCounts,
    studyTime,
    estimateAccuracy,
    recentSessions,
  };
}

export async function createStudySessionForUser(userId, studySessionData) {
  await ensureStudySessionReferences(
    userId,
    studySessionData.courseworkId,
    studySessionData.studyBlockId,
  );

  const result = await query(
    [
      "INSERT INTO study_sessions (",
      "  user_id,",
      "  coursework_id,",
      "  study_block_id,",
      "  source,",
      "  started_at,",
      "  ended_at,",
      "  duration_minutes,",
      "  notes",
      ")",
      "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      "RETURNING id;",
    ].join("\n"),
    [
      userId,
      normalizeOptionalValue(studySessionData.courseworkId),
      normalizeOptionalValue(studySessionData.studyBlockId),
      studySessionData.source,
      normalizeOptionalValue(studySessionData.startedAt),
      normalizeOptionalValue(studySessionData.endedAt),
      studySessionData.durationMinutes,
      normalizeOptionalValue(studySessionData.notes),
    ],
  );

  return getStudySessionForUser(userId, result.rows[0].id);
}

export async function getStudySessionForUser(userId, studySessionId) {
  const result = await query(
    [
      "SELECT " + studySessionSelectColumns,
      studySessionFromClause,
      "WHERE ss.id = $1 AND ss.user_id = $2;",
    ].join("\n"),
    [studySessionId, userId],
  );
  const studySession = result.rows[0];

  if (!studySession) {
    throwStudySessionNotFound();
  }

  return mapStudySessionRow(studySession);
}

export async function updateStudySessionForUser(
  userId,
  studySessionId,
  studySessionData,
) {
  const currentStudySession = await getStudySessionRecordForUser(
    userId,
    studySessionId,
  );
  const nextCourseworkId = hasOwn(studySessionData, "courseworkId")
    ? normalizeOptionalValue(studySessionData.courseworkId)
    : currentStudySession.coursework_id;
  const nextStudyBlockId = hasOwn(studySessionData, "studyBlockId")
    ? normalizeOptionalValue(studySessionData.studyBlockId)
    : currentStudySession.study_block_id;
  const nextStartedAt = hasOwn(studySessionData, "startedAt")
    ? normalizeOptionalValue(studySessionData.startedAt)
    : currentStudySession.started_at;
  const nextEndedAt = hasOwn(studySessionData, "endedAt")
    ? normalizeOptionalValue(studySessionData.endedAt)
    : currentStudySession.ended_at;

  if (hasOwn(studySessionData, "courseworkId")) {
    await ensureCourseworkBelongsToUser(userId, nextCourseworkId);
  }

  if (hasOwn(studySessionData, "studyBlockId")) {
    await ensureStudyBlockBelongsToUser(userId, nextStudyBlockId);
  }

  await ensureStudySessionReferences(
    userId,
    nextCourseworkId,
    nextStudyBlockId,
  );
  assertTimestampOrder(nextStartedAt, nextEndedAt);

  const assignments = [];
  const params = [];

  const nullableUpdateColumnsByField = {
    courseworkId: "coursework_id",
    studyBlockId: "study_block_id",
    startedAt: "started_at",
    endedAt: "ended_at",
    notes: "notes",
  };

  for (const [field, column] of Object.entries(nullableUpdateColumnsByField)) {
    if (!hasOwn(studySessionData, field)) {
      continue;
    }

    params.push(normalizeOptionalValue(studySessionData[field]));
    assignments.push(`${column} = $${params.length}`);
  }

  if (hasOwn(studySessionData, "source")) {
    params.push(studySessionData.source);
    assignments.push(`source = $${params.length}`);
  }

  if (hasOwn(studySessionData, "durationMinutes")) {
    params.push(studySessionData.durationMinutes);
    assignments.push(`duration_minutes = $${params.length}`);
  }

  if (assignments.length === 0) {
    throw badRequest("At least one field must be provided.");
  }

  params.push(studySessionId);
  const studySessionIdParam = params.length;
  params.push(userId);
  const userIdParam = params.length;

  const result = await query(
    [
      "UPDATE study_sessions",
      "SET " + assignments.join(", "),
      "WHERE id = $" + studySessionIdParam + " AND user_id = $" + userIdParam,
      "RETURNING id;",
    ].join("\n"),
    params,
  );

  if (result.rowCount === 0) {
    throwStudySessionNotFound();
  }

  return getStudySessionForUser(userId, studySessionId);
}

export async function deleteStudySessionForUser(userId, studySessionId) {
  const result = await query(
    [
      "DELETE FROM study_sessions",
      "WHERE id = $1 AND user_id = $2",
      "RETURNING id;",
    ].join("\n"),
    [studySessionId, userId],
  );

  if (result.rowCount === 0) {
    throwStudySessionNotFound();
  }
}
