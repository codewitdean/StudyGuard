import { z } from "zod";

const recommendationTypeValues = [
  "move_block",
  "split_task",
  "start_earlier",
  "add_break",
  "reestimate_effort",
  "seek_support",
  "postpone_lower_priority",
];
const recommendationStatusValues = [
  "pending",
  "edited",
  "approved",
  "rejected",
];
const listStatusValues = ["all", ...recommendationStatusValues];

function trimStringValue(value) {
  return typeof value === "string" ? value.trim() : value;
}

function trimmedEnum(values) {
  return z.preprocess(trimStringValue, z.enum(values));
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

const plainJsonObjectSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => !Array.isArray(value), {
    message: "Expected a JSON object.",
  });

const recommendationTypeSchema = trimmedEnum(recommendationTypeValues);

const createRecommendationBodySchema = z.object({
  courseworkId: optionalUuidSchema,
  studyBlockId: optionalUuidSchema,
  type: recommendationTypeSchema,
  title: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(1000),
  proposedChange: plainJsonObjectSchema,
});

const editRecommendationBodySchema = z.object({
  editedChange: plainJsonObjectSchema,
});

const recommendationParamsSchema = z.object({
  recommendationId: z.string().uuid(),
});

export const listRecommendationsSchema = z.object({
  body: z.any().optional(),
  params: z.object({}),
  query: z.object({
    status: z.enum(listStatusValues).optional(),
    type: z.enum(recommendationTypeValues).optional(),
    courseworkId: z.string().uuid().optional(),
    studyBlockId: z.string().uuid().optional(),
  }),
});

export const createRecommendationSchema = z.object({
  body: createRecommendationBodySchema,
  params: z.object({}),
  query: z.object({}),
});

export const recommendationIdSchema = z.object({
  body: z.any().optional(),
  params: recommendationParamsSchema,
  query: z.object({}),
});

export const editRecommendationSchema = z.object({
  body: editRecommendationBodySchema,
  params: recommendationParamsSchema,
  query: z.object({}),
});
