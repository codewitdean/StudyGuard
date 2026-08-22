import { z } from "zod";

const courseworkTypeValues = [
  "assignment",
  "project",
  "quiz",
  "test",
  "exam",
  "reading",
  "study_task",
];
const courseworkPriorityValues = ["low", "medium", "high", "urgent"];
const courseworkDifficultyValues = ["easy", "medium", "hard", "very_hard"];
const courseworkStatusValues = [
  "not_started",
  "in_progress",
  "completed",
  "postponed",
  "missed",
  "archived",
];
const listStatusValues = ["open", "all", ...courseworkStatusValues];
const dueFilterValues = ["all", "upcoming", "overdue", "no_due_date"];
const sortValues = ["dueDate", "createdNewest", "effortHigh"];
const syllabusAnalysisModeValues = ["auto", "ai", "rules"];

function trimStringValue(value) {
  return typeof value === "string" ? value.trim() : value;
}

function trimmedEnum(values) {
  return z.preprocess(trimStringValue, z.enum(values));
}

function optionalTrimmedText(maxLength) {
  let textSchema = z.string().min(1);

  if (maxLength) {
    textSchema = textSchema.max(maxLength);
  }

  return z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmedValue = value.trim();
      return trimmedValue === "" ? null : trimmedValue;
    },
    z.union([z.null(), textSchema]).optional(),
  );
}

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

const requiredUuidSchema = z.preprocess(trimStringValue, z.string().uuid());

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

function parseNumberString(value, emptyValue) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? emptyValue : Number(trimmedValue);
}

const createEstimatedMinutesSchema = z.preprocess(
  (value) => parseNumberString(value, undefined),
  z.number().int().positive().default(60),
);

const updateEstimatedMinutesSchema = z
  .preprocess(
    (value) => parseNumberString(value, value),
    z.number().int().positive(),
  )
  .optional();

const optionalGradeWeightSchema = z.preprocess(
  (value) => parseNumberString(value, null),
  z.union([z.null(), z.number().min(0).max(100)]).optional(),
);

const calendarYearSchema = z.preprocess(
  (value) => parseNumberString(value, undefined),
  z.number().int().min(2000).max(2100).default(new Date().getFullYear()),
);

const courseworkTypeSchema = trimmedEnum(courseworkTypeValues);
const courseworkPrioritySchema = trimmedEnum(courseworkPriorityValues);
const courseworkDifficultySchema = trimmedEnum(courseworkDifficultyValues);
const courseworkStatusSchema = trimmedEnum(courseworkStatusValues);
const syllabusAnalysisModeSchema = trimmedEnum(
  syllabusAnalysisModeValues,
).default("auto");

const createCourseworkBodySchema = z.object({
  courseId: optionalUuidSchema,
  title: z.string().trim().min(1).max(200),
  description: optionalTrimmedText(),
  type: courseworkTypeSchema,
  dueAt: optionalDateTimeSchema,
  priority: courseworkPrioritySchema.default("medium"),
  difficulty: courseworkDifficultySchema.default("medium"),
  estimatedMinutes: createEstimatedMinutesSchema,
  gradeWeight: optionalGradeWeightSchema,
  topic: optionalTrimmedText(120),
  notes: optionalTrimmedText(),
});

const updateCourseworkBodySchema = z
  .object({
    courseId: optionalUuidSchema,
    title: z.string().trim().min(1).max(200).optional(),
    description: optionalTrimmedText(),
    type: courseworkTypeSchema.optional(),
    dueAt: optionalDateTimeSchema,
    priority: courseworkPrioritySchema.optional(),
    difficulty: courseworkDifficultySchema.optional(),
    estimatedMinutes: updateEstimatedMinutesSchema,
    status: courseworkStatusSchema.optional(),
    gradeWeight: optionalGradeWeightSchema,
    topic: optionalTrimmedText(120),
    notes: optionalTrimmedText(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided.",
  });

const syllabusPreviewBodySchema = z.object({
  courseId: requiredUuidSchema,
  fileName: optionalTrimmedText(160),
  syllabusText: z.string().trim().min(20).max(2000000),
  calendarYear: calendarYearSchema,
  analysisMode: syllabusAnalysisModeSchema,
});

const syllabusUploadPreviewBodySchema = z.object({
  courseId: requiredUuidSchema,
  fileName: optionalTrimmedText(160),
  calendarYear: calendarYearSchema,
  analysisMode: syllabusAnalysisModeSchema,
});

const syllabusImportItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalTrimmedText(),
  type: courseworkTypeSchema,
  dueAt: z.string().datetime({ offset: true }),
  priority: courseworkPrioritySchema.default("medium"),
  difficulty: courseworkDifficultySchema.default("medium"),
  estimatedMinutes: createEstimatedMinutesSchema,
  gradeWeight: optionalGradeWeightSchema,
  topic: optionalTrimmedText(120),
  notes: optionalTrimmedText(),
});

const syllabusImportBodySchema = z.object({
  courseId: requiredUuidSchema,
  fileName: optionalTrimmedText(160),
  items: z.array(syllabusImportItemSchema).min(1).max(100),
});

const courseworkParamsSchema = z.object({
  courseworkId: z.string().uuid(),
});

export const listCourseworkSchema = z.object({
  body: z.any().optional(),
  params: z.object({}),
  query: z.object({
    status: z.enum(listStatusValues).default("open"),
    courseId: z.string().uuid().optional(),
    type: z.enum(courseworkTypeValues).optional(),
    due: z.enum(dueFilterValues).default("all"),
    sort: z.enum(sortValues).default("dueDate"),
  }),
});

export const createCourseworkSchema = z.object({
  body: createCourseworkBodySchema,
  params: z.object({}),
  query: z.object({}),
});

export const syllabusPreviewSchema = z.object({
  body: syllabusPreviewBodySchema,
  params: z.object({}),
  query: z.object({}),
});

export const syllabusImportSchema = z.object({
  body: syllabusImportBodySchema,
  params: z.object({}),
  query: z.object({}),
});

export const syllabusUploadPreviewSchema = z.object({
  body: syllabusUploadPreviewBodySchema,
  params: z.object({}),
  query: z.object({}),
});

export const courseworkIdSchema = z.object({
  body: z.any().optional(),
  params: courseworkParamsSchema,
  query: z.object({}),
});

export const updateCourseworkSchema = z.object({
  body: updateCourseworkBodySchema,
  params: courseworkParamsSchema,
  query: z.object({}),
});
