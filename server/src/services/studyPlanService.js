import { query, transaction } from "../database/db.js";
import { conflict, notFound } from "../utils/httpErrors.js";
import {
  buildStudyPlanSchedule,
  getDefaultEndDate,
  getTodayDate,
} from "./schedulingService.js";

const studyPlanNotFoundMessage = "Study plan not found.";

const studyPlanSelectColumns = [
  "id",
  "to_char(plan_start_date, 'YYYY-MM-DD') AS plan_start_date",
  "to_char(plan_end_date, 'YYYY-MM-DD') AS plan_end_date",
  "status",
  "planning_priority",
  "overload_status",
  "generated_at",
  "approved_at",
  "created_at",
  "updated_at",
].join(",\n  ");

const studyBlockSelectColumns = [
  "sb.id",
  "sb.study_plan_id",
  "sb.coursework_id",
  "sb.block_type",
  "sb.start_at",
  "sb.end_at",
  "sb.status",
  "sb.explanation",
  "sb.created_at",
  "sb.updated_at",
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
].join(",\n  ");

function mapStudyPlanRow(row) {
  return {
    id: row.id,
    planStartDate: row.plan_start_date,
    planEndDate: row.plan_end_date,
    status: row.status,
    planningPriority: row.planning_priority,
    overloadStatus: row.overload_status,
    generatedAt: row.generated_at,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

function mapStudyBlockRow(row) {
  return {
    id: row.id,
    studyPlanId: row.study_plan_id,
    courseworkId: row.coursework_id,
    coursework: row.coursework_id
      ? {
          id: row.coursework_id,
          title: row.coursework_title,
          type: row.coursework_type,
          dueAt: row.coursework_due_at,
          priority: row.coursework_priority,
          difficulty: row.coursework_difficulty,
          estimatedMinutes: row.coursework_estimated_minutes,
          course: mapCourseSummary(row),
        }
      : null,
    blockType: row.block_type,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    explanation: row.explanation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCourseworkPlanningRow(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    dueAt: row.due_at,
    priority: row.priority,
    difficulty: row.difficulty,
    estimatedMinutes: row.estimated_minutes,
    gradeWeight: row.grade_weight === null ? null : Number(row.grade_weight),
    course: row.course_summary_id
      ? {
          id: row.course_summary_id,
          name: row.course_name,
          code: row.course_code,
          color: row.course_color,
        }
      : null,
  };
}

function mapWeeklyAvailabilityRow(row) {
  return {
    weekday: row.weekday,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

function mapAvailabilityExceptionRow(row) {
  return {
    exceptionDate: row.exception_date,
    type: row.type,
    isFullDay: row.is_full_day,
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

function throwStudyPlanNotFound() {
  throw notFound(studyPlanNotFoundMessage);
}

function getScheduledMinutes(studyBlocks) {
  return studyBlocks.reduce((total, studyBlock) => {
    return (
      total +
      Math.floor(
        (new Date(studyBlock.endAt).getTime() -
          new Date(studyBlock.startAt).getTime()) /
          60000,
      )
    );
  }, 0);
}

function getStoredPlanSummary(studyBlocks, studyPlan) {
  const scheduledMinutes = getScheduledMinutes(studyBlocks);
  const studyDayCount = new Set(
    studyBlocks.map((studyBlock) =>
      new Date(studyBlock.startAt).toISOString().slice(0, 10),
    ),
  ).size;

  return {
    availableMinutes: scheduledMinutes,
    requiredMinutes: scheduledMinutes,
    scheduledMinutes,
    unscheduledMinutes: 0,
    studyBlockCount: studyBlocks.length,
    studyDayCount,
    overloadStatus: studyPlan.overloadStatus,
  };
}

async function getUserPlanningPriority(userId) {
  const result = await query(
    `
      SELECT planning_priority
      FROM users
      WHERE id = $1;
    `,
    [userId],
  );

  const user = result.rows[0];

  if (!user) {
    throwStudyPlanNotFound();
  }

  return user.planning_priority;
}

async function listPlanningCoursework(userId, startDate) {
  const result = await query(
    `
      SELECT
        cw.id,
        cw.title,
        cw.type,
        cw.due_at,
        cw.priority,
        cw.difficulty,
        cw.estimated_minutes,
        cw.grade_weight,
        c.id AS course_summary_id,
        c.name AS course_name,
        c.code AS course_code,
        c.color AS course_color
      FROM coursework cw
      LEFT JOIN courses c ON c.id = cw.course_id AND c.user_id = cw.user_id
      WHERE cw.user_id = $1
        AND cw.status IN ('not_started', 'in_progress', 'postponed')
        AND cw.estimated_minutes > 0
        AND (cw.due_at IS NULL OR cw.due_at >= $2::date)
      ORDER BY cw.due_at ASC NULLS LAST, cw.created_at ASC;
    `,
    [userId, startDate],
  );

  return result.rows.map(mapCourseworkPlanningRow);
}

async function listPlanningWeeklyAvailability(userId) {
  const result = await query(
    `
      SELECT weekday, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
      FROM weekly_availability
      WHERE user_id = $1
      ORDER BY weekday ASC, start_time ASC;
    `,
    [userId],
  );

  return result.rows.map(mapWeeklyAvailabilityRow);
}

async function listPlanningAvailabilityExceptions(userId, startDate, endDate) {
  const result = await query(
    `
      SELECT
        to_char(exception_date, 'YYYY-MM-DD') AS exception_date,
        type,
        is_full_day,
        to_char(start_time, 'HH24:MI') AS start_time,
        to_char(end_time, 'HH24:MI') AS end_time
      FROM availability_exceptions
      WHERE user_id = $1
        AND exception_date BETWEEN $2::date AND $3::date
      ORDER BY exception_date ASC, is_full_day DESC, start_time ASC NULLS FIRST;
    `,
    [userId, startDate, endDate],
  );

  return result.rows.map(mapAvailabilityExceptionRow);
}

async function getStudyBlocksForPlan(userId, studyPlanId) {
  const result = await query(
    `
      SELECT ${studyBlockSelectColumns}
      FROM study_blocks sb
      LEFT JOIN coursework cw
        ON cw.id = sb.coursework_id
        AND cw.user_id = sb.user_id
      LEFT JOIN courses c
        ON c.id = cw.course_id
        AND c.user_id = cw.user_id
      WHERE sb.study_plan_id = $1
        AND sb.user_id = $2
      ORDER BY sb.start_at ASC;
    `,
    [studyPlanId, userId],
  );

  return result.rows.map(mapStudyBlockRow);
}

export async function listStudyPlansForUser(userId, filters = {}) {
  const conditions = ["sp.user_id = $1"];
  const params = [userId];

  if (filters.status === "current") {
    conditions.push("sp.status IN ('draft', 'active')");
  } else if (filters.status !== "all") {
    params.push(filters.status);
    conditions.push("sp.status = $" + params.length);
  }

  if (filters.from) {
    params.push(filters.from);
    conditions.push("sp.plan_end_date >= $" + params.length + "::date");
  }

  if (filters.to) {
    params.push(filters.to);
    conditions.push("sp.plan_start_date <= $" + params.length + "::date");
  }

  const result = await query(
    `
      SELECT
        sp.id,
        to_char(sp.plan_start_date, 'YYYY-MM-DD') AS plan_start_date,
        to_char(sp.plan_end_date, 'YYYY-MM-DD') AS plan_end_date,
        sp.status,
        sp.planning_priority,
        sp.overload_status,
        sp.generated_at,
        sp.approved_at,
        sp.created_at,
        sp.updated_at,
        COUNT(sb.id)::int AS study_block_count,
        COALESCE(SUM(EXTRACT(EPOCH FROM (sb.end_at - sb.start_at)) / 60), 0)::int AS scheduled_minutes
      FROM study_plans sp
      LEFT JOIN study_blocks sb
        ON sb.study_plan_id = sp.id
        AND sb.user_id = sp.user_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY sp.id
      ORDER BY sp.generated_at DESC;
    `,
    params,
  );

  return result.rows.map((row) => ({
    ...mapStudyPlanRow(row),
    summary: {
      studyBlockCount: row.study_block_count,
      scheduledMinutes: row.scheduled_minutes,
    },
  }));
}

export async function getStudyPlanForUser(userId, studyPlanId) {
  const result = await query(
    `
      SELECT ${studyPlanSelectColumns}
      FROM study_plans
      WHERE id = $1 AND user_id = $2;
    `,
    [studyPlanId, userId],
  );
  const studyPlanRow = result.rows[0];

  if (!studyPlanRow) {
    throwStudyPlanNotFound();
  }

  const studyPlan = mapStudyPlanRow(studyPlanRow);
  const studyBlocks = await getStudyBlocksForPlan(userId, studyPlanId);

  return {
    studyPlan,
    studyBlocks,
    summary: getStoredPlanSummary(studyBlocks, studyPlan),
    unscheduledCoursework: [],
    warnings: [],
    explanations: ["This saved plan was loaded from stored study blocks."],
  };
}

export async function generateStudyPlanForUser(userId, options = {}) {
  const startDate = options.startDate ?? getTodayDate();
  const endDate = options.endDate ?? getDefaultEndDate(startDate);
  const savedPlanningPriority = await getUserPlanningPriority(userId);
  const planningPriority = options.planningPriority ?? savedPlanningPriority;
  const [coursework, weeklyAvailability, availabilityExceptions] =
    await Promise.all([
      listPlanningCoursework(userId, startDate),
      listPlanningWeeklyAvailability(userId),
      listPlanningAvailabilityExceptions(userId, startDate, endDate),
    ]);
  const schedule = buildStudyPlanSchedule({
    startDate,
    endDate,
    planningPriority,
    coursework,
    weeklyAvailability,
    availabilityExceptions,
  });

  const studyPlanId = await transaction(async (client) => {
    await client.query(
      `
        UPDATE study_plans
        SET status = 'archived'
        WHERE user_id = $1
          AND status = 'draft'
          AND plan_start_date = $2::date
          AND plan_end_date = $3::date;
      `,
      [userId, startDate, endDate],
    );

    const planResult = await client.query(
      `
        INSERT INTO study_plans (
          user_id,
          plan_start_date,
          plan_end_date,
          status,
          planning_priority,
          overload_status
        )
        VALUES ($1, $2, $3, 'draft', $4, $5)
        RETURNING id;
      `,
      [
        userId,
        startDate,
        endDate,
        planningPriority,
        schedule.summary.overloadStatus,
      ],
    );
    const createdStudyPlanId = planResult.rows[0].id;

    for (const studyBlock of schedule.studyBlocks) {
      await client.query(
        `
          INSERT INTO study_blocks (
            user_id,
            study_plan_id,
            coursework_id,
            block_type,
            start_at,
            end_at,
            status,
            explanation
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'planned', $7);
        `,
        [
          userId,
          createdStudyPlanId,
          studyBlock.courseworkId,
          studyBlock.blockType,
          studyBlock.startAt,
          studyBlock.endAt,
          studyBlock.explanation,
        ],
      );
    }

    return createdStudyPlanId;
  });

  const detail = await getStudyPlanForUser(userId, studyPlanId);

  return {
    ...detail,
    summary: schedule.summary,
    unscheduledCoursework: schedule.unscheduledCoursework,
    warnings: schedule.warnings,
    explanations: schedule.explanations,
  };
}

export async function approveStudyPlanForUser(userId, studyPlanId) {
  await transaction(async (client) => {
    const planResult = await client.query(
      `
        SELECT id, status, plan_start_date, plan_end_date
        FROM study_plans
        WHERE id = $1 AND user_id = $2;
      `,
      [studyPlanId, userId],
    );
    const studyPlan = planResult.rows[0];

    if (!studyPlan) {
      throwStudyPlanNotFound();
    }

    if (studyPlan.status === "archived") {
      throw conflict("Study plan is already archived.");
    }

    if (studyPlan.status !== "draft") {
      throw conflict("Only draft study plans can be approved.");
    }

    await client.query(
      `
        UPDATE study_plans
        SET status = 'archived'
        WHERE user_id = $1
          AND id <> $2
          AND status = 'active'
          AND plan_start_date <= $4::date
          AND plan_end_date >= $3::date;
      `,
      [userId, studyPlanId, studyPlan.plan_start_date, studyPlan.plan_end_date],
    );

    await client.query(
      `
        UPDATE study_plans
        SET status = 'active', approved_at = now()
        WHERE id = $1 AND user_id = $2;
      `,
      [studyPlanId, userId],
    );
  });

  return getStudyPlanForUser(userId, studyPlanId);
}

export async function archiveStudyPlanForUser(userId, studyPlanId) {
  await transaction(async (client) => {
    const planResult = await client.query(
      `
        SELECT id, status
        FROM study_plans
        WHERE id = $1 AND user_id = $2;
      `,
      [studyPlanId, userId],
    );
    const studyPlan = planResult.rows[0];

    if (!studyPlan) {
      throwStudyPlanNotFound();
    }

    if (studyPlan.status === "archived") {
      throw conflict("Study plan is already archived.");
    }

    await client.query(
      `
        UPDATE study_plans
        SET status = 'archived'
        WHERE id = $1 AND user_id = $2;
      `,
      [studyPlanId, userId],
    );
  });

  return getStudyPlanForUser(userId, studyPlanId);
}
