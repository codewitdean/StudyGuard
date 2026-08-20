import { z } from "zod";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const availabilityExceptionTypeValues = ["unavailable", "extra_available"];
const availabilityExceptionListTypeValues = [
  "all",
  ...availabilityExceptionTypeValues,
];

function trimStringValue(value) {
  return typeof value === "string" ? value.trim() : value;
}

function parseIntegerString(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? value : Number(trimmedValue);
}

function optionalTrimmedText(maxLength) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmedValue = value.trim();
      return trimmedValue === "" ? null : trimmedValue;
    },
    z.union([z.null(), z.string().min(1).max(maxLength)]).optional(),
  );
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

function addTimeRangeIssue(context) {
  context.addIssue({
    code: "custom",
    message: "startTime must be before endTime.",
    path: ["endTime"],
  });
}

const weekdaySchema = z.preprocess(
  parseIntegerString,
  z.number().int().min(1).max(7),
);

const timeSchema = z.preprocess(
  trimStringValue,
  z.string().regex(timePattern, "Expected HH:mm time."),
);

const optionalTimeSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? null : trimmedValue;
  },
  z
    .union([z.null(), z.string().regex(timePattern, "Expected HH:mm time.")])
    .optional(),
);

const dateSchema = z.preprocess(
  trimStringValue,
  z.string().refine(isValidDateString, {
    message: "Expected YYYY-MM-DD date.",
  }),
);

const exceptionTypeSchema = z.preprocess(
  trimStringValue,
  z.enum(availabilityExceptionTypeValues),
);

const createWeeklyAvailabilityBodySchema = z
  .object({
    weekday: weekdaySchema,
    startTime: timeSchema,
    endTime: timeSchema,
    label: optionalTrimmedText(80),
  })
  .superRefine((body, context) => {
    if (body.startTime >= body.endTime) {
      addTimeRangeIssue(context);
    }
  });

const updateWeeklyAvailabilityBodySchema = z
  .object({
    weekday: weekdaySchema.optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    label: optionalTrimmedText(80),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided.",
  })
  .superRefine((body, context) => {
    if (body.startTime && body.endTime && body.startTime >= body.endTime) {
      addTimeRangeIssue(context);
    }
  });

const createAvailabilityExceptionBodySchema = z
  .object({
    exceptionDate: dateSchema,
    type: exceptionTypeSchema,
    isFullDay: z.boolean().default(false),
    startTime: optionalTimeSchema,
    endTime: optionalTimeSchema,
    reason: optionalTrimmedText(160),
  })
  .superRefine((body, context) => {
    if (body.isFullDay) {
      if (body.startTime || body.endTime) {
        context.addIssue({
          code: "custom",
          message: "Full-day exceptions cannot include startTime or endTime.",
          path: ["startTime"],
        });
      }

      return;
    }

    if (!body.startTime) {
      context.addIssue({
        code: "custom",
        message: "Partial-day exceptions require startTime.",
        path: ["startTime"],
      });
    }

    if (!body.endTime) {
      context.addIssue({
        code: "custom",
        message: "Partial-day exceptions require endTime.",
        path: ["endTime"],
      });
    }

    if (body.startTime && body.endTime && body.startTime >= body.endTime) {
      addTimeRangeIssue(context);
    }
  });

const updateAvailabilityExceptionBodySchema = z
  .object({
    exceptionDate: dateSchema.optional(),
    type: exceptionTypeSchema.optional(),
    isFullDay: z.boolean().optional(),
    startTime: optionalTimeSchema,
    endTime: optionalTimeSchema,
    reason: optionalTrimmedText(160),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided.",
  })
  .superRefine((body, context) => {
    if (body.isFullDay === true && (body.startTime || body.endTime)) {
      context.addIssue({
        code: "custom",
        message: "Full-day exceptions cannot include startTime or endTime.",
        path: ["startTime"],
      });
    }

    if (body.startTime && body.endTime && body.startTime >= body.endTime) {
      addTimeRangeIssue(context);
    }
  });

const availabilityWindowParamsSchema = z.object({
  availabilityWindowId: z.string().uuid(),
});

const availabilityExceptionParamsSchema = z.object({
  availabilityExceptionId: z.string().uuid(),
});

export const listWeeklyAvailabilitySchema = z.object({
  body: z.any().optional(),
  params: z.object({}),
  query: z.object({
    weekday: weekdaySchema.optional(),
  }),
});

export const createWeeklyAvailabilitySchema = z.object({
  body: createWeeklyAvailabilityBodySchema,
  params: z.object({}),
  query: z.object({}),
});

export const availabilityWindowIdSchema = z.object({
  body: z.any().optional(),
  params: availabilityWindowParamsSchema,
  query: z.object({}),
});

export const updateWeeklyAvailabilitySchema = z.object({
  body: updateWeeklyAvailabilityBodySchema,
  params: availabilityWindowParamsSchema,
  query: z.object({}),
});

export const listAvailabilityExceptionsSchema = z
  .object({
    body: z.any().optional(),
    params: z.object({}),
    query: z.object({
      from: dateSchema.optional(),
      to: dateSchema.optional(),
      type: z.enum(availabilityExceptionListTypeValues).default("all"),
    }),
  })
  .refine(
    (request) => {
      const { from, to } = request.query;
      return !from || !to || from <= to;
    },
    {
      message: "from must be on or before to.",
      path: ["query", "to"],
    },
  );

export const createAvailabilityExceptionSchema = z.object({
  body: createAvailabilityExceptionBodySchema,
  params: z.object({}),
  query: z.object({}),
});

export const availabilityExceptionIdSchema = z.object({
  body: z.any().optional(),
  params: availabilityExceptionParamsSchema,
  query: z.object({}),
});

export const updateAvailabilityExceptionSchema = z.object({
  body: updateAvailabilityExceptionBodySchema,
  params: availabilityExceptionParamsSchema,
  query: z.object({}),
});
