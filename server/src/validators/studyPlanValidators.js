import { z } from "zod";

const planningPriorityValues = [
  "meet_deadlines",
  "prevent_burnout",
  "balance_deadlines_wellbeing",
  "custom",
];
const listStatusValues = ["current", "all", "draft", "active", "archived"];
const maxPlanRangeDays = 31;

function trimStringValue(value) {
  return typeof value === "string" ? value.trim() : value;
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

function getDateRangeDays(startDate, endDate) {
  const start = new Date(startDate + "T00:00:00.000Z");
  const end = new Date(endDate + "T00:00:00.000Z");
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

const dateSchema = z.preprocess(
  trimStringValue,
  z.string().refine(isValidDateString, {
    message: "Expected YYYY-MM-DD date.",
  }),
);

const planningPrioritySchema = z.preprocess(
  trimStringValue,
  z.enum(planningPriorityValues),
);

function addGenerateDateRangeIssues(body, context) {
  if (!body.startDate || !body.endDate) {
    return;
  }

  if (body.startDate > body.endDate) {
    context.addIssue({
      code: "custom",
      message: "startDate must be on or before endDate.",
      path: ["endDate"],
    });
    return;
  }

  if (getDateRangeDays(body.startDate, body.endDate) > maxPlanRangeDays) {
    context.addIssue({
      code: "custom",
      message: "Study plan ranges can be at most 31 days.",
      path: ["endDate"],
    });
  }
}

const generateStudyPlanBodySchema = z
  .object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    planningPriority: planningPrioritySchema.optional(),
  })
  .superRefine(addGenerateDateRangeIssues);

const listStudyPlansQuerySchema = z
  .object({
    status: z.enum(listStatusValues).default("current"),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .superRefine((query, context) => {
    if (query.from && query.to && query.from > query.to) {
      context.addIssue({
        code: "custom",
        message: "from must be on or before to.",
        path: ["to"],
      });
    }
  });

const studyPlanParamsSchema = z.object({
  studyPlanId: z.string().uuid(),
});

export const generateStudyPlanSchema = z.object({
  body: generateStudyPlanBodySchema.default({}),
  params: z.object({}),
  query: z.object({}),
});

export const listStudyPlansSchema = z.object({
  body: z.any().optional(),
  params: z.object({}),
  query: listStudyPlansQuerySchema,
});

export const studyPlanIdSchema = z.object({
  body: z.any().optional(),
  params: studyPlanParamsSchema,
  query: z.object({}),
});
