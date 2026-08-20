import { query } from "../database/db.js";
import { badRequest, conflict, notFound } from "../utils/httpErrors.js";

const availabilityWindowNotFoundMessage = "Availability window not found.";
const availabilityExceptionNotFoundMessage =
  "Availability exception not found.";
const availabilityWindowConflictMessage =
  "Availability window conflicts with an existing window.";
const availabilityExceptionConflictMessage =
  "Availability exception conflicts with an existing exception.";

const weeklyAvailabilitySelectColumns = [
  "id",
  "weekday",
  "to_char(start_time, 'HH24:MI') AS start_time",
  "to_char(end_time, 'HH24:MI') AS end_time",
  "label",
  "created_at",
  "updated_at",
].join(",\n  ");

const availabilityExceptionSelectColumns = [
  "id",
  "to_char(exception_date, 'YYYY-MM-DD') AS exception_date",
  "type",
  "is_full_day",
  "to_char(start_time, 'HH24:MI') AS start_time",
  "to_char(end_time, 'HH24:MI') AS end_time",
  "reason",
  "created_at",
  "updated_at",
].join(",\n  ");

function normalizeOptionalValue(value) {
  return value ?? null;
}

function hasField(data, field) {
  return Object.hasOwn(data, field);
}

function mapWeeklyAvailabilityRow(row) {
  return {
    id: row.id,
    weekday: row.weekday,
    startTime: row.start_time,
    endTime: row.end_time,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAvailabilityExceptionRow(row) {
  return {
    id: row.id,
    exceptionDate: row.exception_date,
    type: row.type,
    isFullDay: row.is_full_day,
    startTime: row.start_time,
    endTime: row.end_time,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function throwAvailabilityWindowNotFound() {
  throw notFound(availabilityWindowNotFoundMessage);
}

function throwAvailabilityExceptionNotFound() {
  throw notFound(availabilityExceptionNotFoundMessage);
}

function validateTimeRange(startTime, endTime) {
  if (startTime >= endTime) {
    throw badRequest("startTime must be before endTime.");
  }
}

function validateExceptionShape(availabilityException) {
  if (availabilityException.isFullDay) {
    return;
  }

  if (!availabilityException.startTime || !availabilityException.endTime) {
    throw badRequest(
      "Partial-day availability exceptions require startTime and endTime.",
    );
  }

  validateTimeRange(
    availabilityException.startTime,
    availabilityException.endTime,
  );
}

async function ensureNoWeeklyAvailabilityConflict(
  userId,
  weekday,
  startTime,
  endTime,
  excludedAvailabilityWindowId,
) {
  const params = [userId, weekday, startTime, endTime];
  const conditions = [
    "user_id = $1",
    "weekday = $2",
    "start_time < $4::time",
    "end_time > $3::time",
  ];

  if (excludedAvailabilityWindowId) {
    params.push(excludedAvailabilityWindowId);
    conditions.push("id <> $" + params.length);
  }

  const result = await query(
    [
      "SELECT id",
      "FROM weekly_availability",
      "WHERE " + conditions.join(" AND "),
      "LIMIT 1;",
    ].join("\n"),
    params,
  );

  if (result.rowCount > 0) {
    throw conflict(availabilityWindowConflictMessage);
  }
}

async function ensureNoAvailabilityExceptionConflict(
  userId,
  availabilityException,
  excludedAvailabilityExceptionId,
) {
  const params = [userId, availabilityException.exceptionDate];
  const conditions = ["user_id = $1", "exception_date = $2::date"];

  if (excludedAvailabilityExceptionId) {
    params.push(excludedAvailabilityExceptionId);
    conditions.push("id <> $" + params.length);
  }

  if (!availabilityException.isFullDay) {
    params.push(availabilityException.endTime);
    const endTimeParam = params.length;
    params.push(availabilityException.startTime);
    const startTimeParam = params.length;

    conditions.push(
      "(is_full_day = true OR (start_time < $" +
        endTimeParam +
        "::time AND end_time > $" +
        startTimeParam +
        "::time))",
    );
  }

  const result = await query(
    [
      "SELECT id",
      "FROM availability_exceptions",
      "WHERE " + conditions.join(" AND "),
      "LIMIT 1;",
    ].join("\n"),
    params,
  );

  if (result.rowCount > 0) {
    throw conflict(availabilityExceptionConflictMessage);
  }
}

export async function listWeeklyAvailabilityForUser(userId, filters = {}) {
  const conditions = ["user_id = $1"];
  const params = [userId];

  if (filters.weekday) {
    params.push(filters.weekday);
    conditions.push("weekday = $" + params.length);
  }

  const result = await query(
    [
      "SELECT " + weeklyAvailabilitySelectColumns,
      "FROM weekly_availability",
      "WHERE " + conditions.join(" AND "),
      "ORDER BY weekday ASC, start_time ASC;",
    ].join("\n"),
    params,
  );

  return result.rows.map(mapWeeklyAvailabilityRow);
}

export async function createWeeklyAvailabilityForUser(
  userId,
  availabilityData,
) {
  await ensureNoWeeklyAvailabilityConflict(
    userId,
    availabilityData.weekday,
    availabilityData.startTime,
    availabilityData.endTime,
  );

  const result = await query(
    [
      "INSERT INTO weekly_availability (user_id, weekday, start_time, end_time, label)",
      "VALUES ($1, $2, $3, $4, $5)",
      "RETURNING id;",
    ].join("\n"),
    [
      userId,
      availabilityData.weekday,
      availabilityData.startTime,
      availabilityData.endTime,
      normalizeOptionalValue(availabilityData.label),
    ],
  );

  return getWeeklyAvailabilityForUser(userId, result.rows[0].id);
}

export async function getWeeklyAvailabilityForUser(
  userId,
  availabilityWindowId,
) {
  const result = await query(
    [
      "SELECT " + weeklyAvailabilitySelectColumns,
      "FROM weekly_availability",
      "WHERE id = $1 AND user_id = $2;",
    ].join("\n"),
    [availabilityWindowId, userId],
  );

  const availabilityWindow = result.rows[0];

  if (!availabilityWindow) {
    throwAvailabilityWindowNotFound();
  }

  return mapWeeklyAvailabilityRow(availabilityWindow);
}

export async function updateWeeklyAvailabilityForUser(
  userId,
  availabilityWindowId,
  availabilityData,
) {
  const currentAvailabilityWindow = await getWeeklyAvailabilityForUser(
    userId,
    availabilityWindowId,
  );
  const nextAvailabilityWindow = {
    weekday: hasField(availabilityData, "weekday")
      ? availabilityData.weekday
      : currentAvailabilityWindow.weekday,
    startTime: hasField(availabilityData, "startTime")
      ? availabilityData.startTime
      : currentAvailabilityWindow.startTime,
    endTime: hasField(availabilityData, "endTime")
      ? availabilityData.endTime
      : currentAvailabilityWindow.endTime,
    label: hasField(availabilityData, "label")
      ? normalizeOptionalValue(availabilityData.label)
      : currentAvailabilityWindow.label,
  };

  validateTimeRange(
    nextAvailabilityWindow.startTime,
    nextAvailabilityWindow.endTime,
  );
  await ensureNoWeeklyAvailabilityConflict(
    userId,
    nextAvailabilityWindow.weekday,
    nextAvailabilityWindow.startTime,
    nextAvailabilityWindow.endTime,
    availabilityWindowId,
  );

  const result = await query(
    [
      "UPDATE weekly_availability",
      "SET weekday = $1, start_time = $2, end_time = $3, label = $4",
      "WHERE id = $5 AND user_id = $6",
      "RETURNING id;",
    ].join("\n"),
    [
      nextAvailabilityWindow.weekday,
      nextAvailabilityWindow.startTime,
      nextAvailabilityWindow.endTime,
      nextAvailabilityWindow.label,
      availabilityWindowId,
      userId,
    ],
  );

  const updatedAvailabilityWindow = result.rows[0];

  if (!updatedAvailabilityWindow) {
    throwAvailabilityWindowNotFound();
  }

  return getWeeklyAvailabilityForUser(userId, updatedAvailabilityWindow.id);
}

export async function deleteWeeklyAvailabilityForUser(
  userId,
  availabilityWindowId,
) {
  const result = await query(
    [
      "DELETE FROM weekly_availability",
      "WHERE id = $1 AND user_id = $2",
      "RETURNING id;",
    ].join("\n"),
    [availabilityWindowId, userId],
  );

  if (result.rowCount === 0) {
    throwAvailabilityWindowNotFound();
  }
}

export async function listAvailabilityExceptionsForUser(userId, filters = {}) {
  const conditions = ["user_id = $1"];
  const params = [userId];

  if (filters.from) {
    params.push(filters.from);
    conditions.push("exception_date >= $" + params.length + "::date");
  }

  if (filters.to) {
    params.push(filters.to);
    conditions.push("exception_date <= $" + params.length + "::date");
  }

  if (filters.type && filters.type !== "all") {
    params.push(filters.type);
    conditions.push("type = $" + params.length);
  }

  const result = await query(
    [
      "SELECT " + availabilityExceptionSelectColumns,
      "FROM availability_exceptions",
      "WHERE " + conditions.join(" AND "),
      "ORDER BY exception_date ASC, is_full_day DESC, start_time ASC NULLS FIRST;",
    ].join("\n"),
    params,
  );

  return result.rows.map(mapAvailabilityExceptionRow);
}

export async function createAvailabilityExceptionForUser(
  userId,
  availabilityExceptionData,
) {
  const availabilityException = {
    exceptionDate: availabilityExceptionData.exceptionDate,
    type: availabilityExceptionData.type,
    isFullDay: availabilityExceptionData.isFullDay,
    startTime: availabilityExceptionData.isFullDay
      ? null
      : normalizeOptionalValue(availabilityExceptionData.startTime),
    endTime: availabilityExceptionData.isFullDay
      ? null
      : normalizeOptionalValue(availabilityExceptionData.endTime),
    reason: normalizeOptionalValue(availabilityExceptionData.reason),
  };

  validateExceptionShape(availabilityException);
  await ensureNoAvailabilityExceptionConflict(userId, availabilityException);

  const result = await query(
    [
      "INSERT INTO availability_exceptions (user_id, exception_date, type, is_full_day, start_time, end_time, reason)",
      "VALUES ($1, $2, $3, $4, $5, $6, $7)",
      "RETURNING id;",
    ].join("\n"),
    [
      userId,
      availabilityException.exceptionDate,
      availabilityException.type,
      availabilityException.isFullDay,
      availabilityException.startTime,
      availabilityException.endTime,
      availabilityException.reason,
    ],
  );

  return getAvailabilityExceptionForUser(userId, result.rows[0].id);
}

export async function getAvailabilityExceptionForUser(
  userId,
  availabilityExceptionId,
) {
  const result = await query(
    [
      "SELECT " + availabilityExceptionSelectColumns,
      "FROM availability_exceptions",
      "WHERE id = $1 AND user_id = $2;",
    ].join("\n"),
    [availabilityExceptionId, userId],
  );

  const availabilityException = result.rows[0];

  if (!availabilityException) {
    throwAvailabilityExceptionNotFound();
  }

  return mapAvailabilityExceptionRow(availabilityException);
}

export async function updateAvailabilityExceptionForUser(
  userId,
  availabilityExceptionId,
  availabilityExceptionData,
) {
  const currentAvailabilityException = await getAvailabilityExceptionForUser(
    userId,
    availabilityExceptionId,
  );
  const isFullDay = hasField(availabilityExceptionData, "isFullDay")
    ? availabilityExceptionData.isFullDay
    : currentAvailabilityException.isFullDay;
  const nextAvailabilityException = {
    exceptionDate: hasField(availabilityExceptionData, "exceptionDate")
      ? availabilityExceptionData.exceptionDate
      : currentAvailabilityException.exceptionDate,
    type: hasField(availabilityExceptionData, "type")
      ? availabilityExceptionData.type
      : currentAvailabilityException.type,
    isFullDay,
    startTime: isFullDay
      ? null
      : hasField(availabilityExceptionData, "startTime")
        ? normalizeOptionalValue(availabilityExceptionData.startTime)
        : currentAvailabilityException.startTime,
    endTime: isFullDay
      ? null
      : hasField(availabilityExceptionData, "endTime")
        ? normalizeOptionalValue(availabilityExceptionData.endTime)
        : currentAvailabilityException.endTime,
    reason: hasField(availabilityExceptionData, "reason")
      ? normalizeOptionalValue(availabilityExceptionData.reason)
      : currentAvailabilityException.reason,
  };

  validateExceptionShape(nextAvailabilityException);
  await ensureNoAvailabilityExceptionConflict(
    userId,
    nextAvailabilityException,
    availabilityExceptionId,
  );

  const result = await query(
    [
      "UPDATE availability_exceptions",
      "SET exception_date = $1, type = $2, is_full_day = $3, start_time = $4, end_time = $5, reason = $6",
      "WHERE id = $7 AND user_id = $8",
      "RETURNING id;",
    ].join("\n"),
    [
      nextAvailabilityException.exceptionDate,
      nextAvailabilityException.type,
      nextAvailabilityException.isFullDay,
      nextAvailabilityException.startTime,
      nextAvailabilityException.endTime,
      nextAvailabilityException.reason,
      availabilityExceptionId,
      userId,
    ],
  );

  const updatedAvailabilityException = result.rows[0];

  if (!updatedAvailabilityException) {
    throwAvailabilityExceptionNotFound();
  }

  return getAvailabilityExceptionForUser(
    userId,
    updatedAvailabilityException.id,
  );
}

export async function deleteAvailabilityExceptionForUser(
  userId,
  availabilityExceptionId,
) {
  const result = await query(
    [
      "DELETE FROM availability_exceptions",
      "WHERE id = $1 AND user_id = $2",
      "RETURNING id;",
    ].join("\n"),
    [availabilityExceptionId, userId],
  );

  if (result.rowCount === 0) {
    throwAvailabilityExceptionNotFound();
  }
}
