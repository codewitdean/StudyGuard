import { query } from "../database/db.js";
import { conflict, notFound } from "../utils/httpErrors.js";

const recommendationNotFoundMessage = "Recommendation not found.";
const courseworkNotFoundMessage = "Coursework item not found.";
const studyBlockNotFoundMessage = "Study block not found.";

const recommendationSelectColumns = [
  "r.id",
  "r.coursework_id AS recommendation_coursework_id",
  "r.study_block_id AS recommendation_study_block_id",
  "r.type",
  "r.status",
  "r.title",
  "r.reason",
  "r.proposed_change",
  "r.edited_change",
  "r.decided_at",
  "r.created_at",
  "r.updated_at",
  "cw.id AS coursework_summary_id",
  "cw.title AS coursework_title",
  "cw.type AS coursework_type",
  "cw.due_at AS coursework_due_at",
  "cw.priority AS coursework_priority",
  "cw.difficulty AS coursework_difficulty",
  "cw.estimated_minutes AS coursework_estimated_minutes",
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

const recommendationFromClause = [
  "FROM recommendations r",
  "LEFT JOIN coursework cw",
  "  ON cw.id = r.coursework_id",
  "  AND cw.user_id = r.user_id",
  "LEFT JOIN courses c",
  "  ON c.id = cw.course_id",
  "  AND c.user_id = cw.user_id",
  "LEFT JOIN study_blocks sb",
  "  ON sb.id = r.study_block_id",
  "  AND sb.user_id = r.user_id",
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
    priority: row.coursework_priority,
    difficulty: row.coursework_difficulty,
    estimatedMinutes: row.coursework_estimated_minutes,
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

function mapRecommendationRow(row) {
  return {
    id: row.id,
    courseworkId: row.recommendation_coursework_id,
    studyBlockId: row.recommendation_study_block_id,
    type: row.type,
    status: row.status,
    title: row.title,
    reason: row.reason,
    proposedChange: row.proposed_change,
    editedChange: row.edited_change,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    coursework: mapCourseworkSummary(row),
    studyBlock: mapStudyBlockSummary(row),
  };
}

function normalizeOptionalValue(value) {
  return value ?? null;
}

function throwRecommendationNotFound() {
  throw notFound(recommendationNotFoundMessage);
}

function throwCourseworkNotFound() {
  throw notFound(courseworkNotFoundMessage);
}

function throwStudyBlockNotFound() {
  throw notFound(studyBlockNotFoundMessage);
}

function throwIfTerminalStatus(recommendation) {
  if (recommendation.status === "approved") {
    throw conflict("Recommendation is already approved.");
  }

  if (recommendation.status === "rejected") {
    throw conflict("Recommendation is already rejected.");
  }
}

async function ensureCourseworkBelongsToUser(userId, courseworkId) {
  if (courseworkId === undefined || courseworkId === null) {
    return;
  }

  const result = await query(
    ["SELECT id", "FROM coursework", "WHERE id = $1 AND user_id = $2;"].join(
      "\n",
    ),
    [courseworkId, userId],
  );

  if (result.rowCount === 0) {
    throwCourseworkNotFound();
  }
}

async function ensureStudyBlockBelongsToUser(userId, studyBlockId) {
  if (studyBlockId === undefined || studyBlockId === null) {
    return;
  }

  const result = await query(
    ["SELECT id", "FROM study_blocks", "WHERE id = $1 AND user_id = $2;"].join(
      "\n",
    ),
    [studyBlockId, userId],
  );

  if (result.rowCount === 0) {
    throwStudyBlockNotFound();
  }
}

async function getRecommendationRecordForUser(userId, recommendationId) {
  const result = await query(
    [
      "SELECT id, status",
      "FROM recommendations",
      "WHERE id = $1 AND user_id = $2;",
    ].join("\n"),
    [recommendationId, userId],
  );
  const recommendation = result.rows[0];

  if (!recommendation) {
    throwRecommendationNotFound();
  }

  return recommendation;
}

export async function listRecommendationsForUser(userId, filters = {}) {
  const conditions = ["r.user_id = $1"];
  const params = [userId];

  if (!filters.status) {
    conditions.push("r.status IN ('pending', 'edited')");
  } else if (filters.status !== "all") {
    params.push(filters.status);
    conditions.push("r.status = $" + params.length);
  }

  if (filters.type) {
    params.push(filters.type);
    conditions.push("r.type = $" + params.length);
  }

  if (filters.courseworkId) {
    params.push(filters.courseworkId);
    conditions.push("r.coursework_id = $" + params.length);
  }

  if (filters.studyBlockId) {
    params.push(filters.studyBlockId);
    conditions.push("r.study_block_id = $" + params.length);
  }

  const result = await query(
    [
      "SELECT " + recommendationSelectColumns,
      recommendationFromClause,
      "WHERE " + conditions.join(" AND "),
      "ORDER BY r.created_at DESC;",
    ].join("\n"),
    params,
  );

  return result.rows.map(mapRecommendationRow);
}

export async function createRecommendationForUser(userId, recommendationData) {
  await ensureCourseworkBelongsToUser(userId, recommendationData.courseworkId);
  await ensureStudyBlockBelongsToUser(userId, recommendationData.studyBlockId);

  const result = await query(
    [
      "INSERT INTO recommendations (",
      "  user_id,",
      "  coursework_id,",
      "  study_block_id,",
      "  type,",
      "  title,",
      "  reason,",
      "  proposed_change",
      ")",
      "VALUES ($1, $2, $3, $4, $5, $6, $7)",
      "RETURNING id;",
    ].join("\n"),
    [
      userId,
      normalizeOptionalValue(recommendationData.courseworkId),
      normalizeOptionalValue(recommendationData.studyBlockId),
      recommendationData.type,
      recommendationData.title,
      recommendationData.reason,
      recommendationData.proposedChange,
    ],
  );

  return getRecommendationForUser(userId, result.rows[0].id);
}

export async function getRecommendationForUser(userId, recommendationId) {
  const result = await query(
    [
      "SELECT " + recommendationSelectColumns,
      recommendationFromClause,
      "WHERE r.id = $1 AND r.user_id = $2;",
    ].join("\n"),
    [recommendationId, userId],
  );
  const recommendation = result.rows[0];

  if (!recommendation) {
    throwRecommendationNotFound();
  }

  return mapRecommendationRow(recommendation);
}

export async function editRecommendationForUser(
  userId,
  recommendationId,
  recommendationData,
) {
  const recommendation = await getRecommendationRecordForUser(
    userId,
    recommendationId,
  );

  throwIfTerminalStatus(recommendation);

  await query(
    [
      "UPDATE recommendations",
      "SET status = 'edited', edited_change = $1, decided_at = now()",
      "WHERE id = $2 AND user_id = $3;",
    ].join("\n"),
    [recommendationData.editedChange, recommendationId, userId],
  );

  return getRecommendationForUser(userId, recommendationId);
}

export async function approveRecommendationForUser(userId, recommendationId) {
  const recommendation = await getRecommendationRecordForUser(
    userId,
    recommendationId,
  );

  throwIfTerminalStatus(recommendation);

  await query(
    [
      "UPDATE recommendations",
      "SET status = 'approved', decided_at = now()",
      "WHERE id = $1 AND user_id = $2;",
    ].join("\n"),
    [recommendationId, userId],
  );

  return getRecommendationForUser(userId, recommendationId);
}

export async function rejectRecommendationForUser(userId, recommendationId) {
  const recommendation = await getRecommendationRecordForUser(
    userId,
    recommendationId,
  );

  throwIfTerminalStatus(recommendation);

  await query(
    [
      "UPDATE recommendations",
      "SET status = 'rejected', decided_at = now()",
      "WHERE id = $1 AND user_id = $2;",
    ].join("\n"),
    [recommendationId, userId],
  );

  return getRecommendationForUser(userId, recommendationId);
}

export async function deleteRecommendationForUser(userId, recommendationId) {
  const result = await query(
    [
      "DELETE FROM recommendations",
      "WHERE id = $1 AND user_id = $2",
      "RETURNING id;",
    ].join("\n"),
    [recommendationId, userId],
  );

  if (result.rowCount === 0) {
    throwRecommendationNotFound();
  }
}
