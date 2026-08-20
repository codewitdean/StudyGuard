import { z } from "zod";

const studySessionSourceValues = ["manual", "timer"];
const maxProgressRangeDays = 366;
const maxDurationMinutes = 1440;

function trimStringValue(value) {
  return typeof value === "string" ? value.trim() : value;
}

function parseNumberString(value, emptyValue) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? emptyValue : Number(trimmedValue);
}

function isValidDateString(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getDateRangeDays(from, to) {
  const start = new Date(from + "T00:00:00.000Z");
  const end = new Date(to + "T00:00:00.000Z");
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function addDateRangeIssues(query, context) {
  if (!query.from || !query.to) {
    return;
  }

  if (query.from > query.to) {
    context.addIssue({
      code: "custom",
      message: "from must be on or before to.",
      path: ["to"],
    });
    return;
  }

  if (getDateRangeDays(query.from, query.to) > maxProgressRangeDays) {
    context.addIssue({
      code: "custom",
      message: "Progress ranges can be at most 366 days.",
      path: ["to"],
    });
  }
}

function addTimestampOrderIssue(body, context) {
  if (!body.startedAt || !body.endedAt) {
    return;
  }

  if (new Date(body.startedAt).getTime() >= new Date(body.endedAt).getTime()) {
    context.addIssue({
      code: "custom",
      message: "startedAt must be before endedAt.",
      path: ["endedAt"],
    });
  }
}

const dateSchema = z.preprocess(
  trimStringValue,
  z.string().refine(isValidDateString, {
    message: "Expected YYYY-MM-DD date.",
  }),
);

const optionalUuidSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? null : trimmedValue;
  },
  z.union([z.null(), z.string().uuid()]).optional(),
);

const optionalDateTimeSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? null : trimmedValue;
  },
  z.union([z.null(), z.string().datetime({ offset: true })]).optional(),
);

const optionalNotesSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? null : trimmedValue;
  },
  z.union([z.null(), z.string().max(1000)]).optional(),
);

const sourceSchema = z.preprocess(
  trimStringValue,
  z.enum(studySessionSourceValues),
);

const createDurationSchema = z.preprocess(
  (value) => parseNumberString(value, value),
  z.number().int().positive().max(maxDurationMinutes),
);

const updateDurationSchema = z
  .preprocess(
    (value) => parseNumberString(value, value),
    z.number().int().positive().max(maxDurationMinutes),
  )
  .optional();

const limitSchema = z.preprocess(
  (value) => parseNumberString(value, 25),
  z.number().int().min(1).max(100).default(25),
);

const progressDateRangeQuerySchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .superRefine(addDateRangeIssues);

const progressSummaryQuerySchema = progressDateRangeQuerySchema.extend({
  courseId: z.string().uuid().optional(),
  courseworkId: z.string().uuid().optional(),
});

const listStudySessionsQuerySchema = progressDateRangeQuerySchema.extend({
  courseworkId: z.string().uuid().optional(),
  studyBlockId: z.string().uuid().optional(),
  source: z.enum(studySessionSourceValues).optional(),
  limit: limitSchema,
});

const createStudySessionBodySchema = z
  .object({
    courseworkId: optionalUuidSchema,
    studyBlockId: optionalUuidSchema,
    source: sourceSchema.default("manual"),
    startedAt: optionalDateTimeSchema,
    endedAt: optionalDateTimeSchema,
    durationMinutes: createDurationSchema,
    notes: optionalNotesSchema,
  })
  .superRefine(addTimestampOrderIssue);

const updateStudySessionBodySchema = z
  .object({
    courseworkId: optionalUuidSchema,
    studyBlockId: optionalUuidSchema,
    source: sourceSchema.optional(),
    startedAt: optionalDateTimeSchema,
    endedAt: optionalDateTimeSchema,
    durationMinutes: updateDurationSchema,
    notes: optionalNotesSchema,
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided.",
  })
  .superRefine(addTimestampOrderIssue);

const studySessionParamsSchema = z.object({
  studySessionId: z.string().uuid(),
});

export const progressSummarySchema = z.object({
  body: z.any().optional(),
  params: z.object({}),
  query: progressSummaryQuerySchema,
});

export const listStudySessionsSchema = z.object({
  body: z.any().optional(),
  params: z.object({}),
  query: listStudySessionsQuerySchema,
});

export const createStudySessionSchema = z.object({
  body: createStudySessionBodySchema,
  params: z.object({}),
  query: z.object({}),
});

export const studySessionIdSchema = z.object({
  body: z.any().optional(),
  params: studySessionParamsSchema,
  query: z.object({}),
});

export const updateStudySessionSchema = z.object({
  body: updateStudySessionBodySchema,
  params: studySessionParamsSchema,
  query: z.object({}),
});
