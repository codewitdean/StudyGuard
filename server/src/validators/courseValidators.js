import { z } from "zod";

const courseStatusSchema = z.enum(["active", "archived", "all"]);
const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;

function optionalTrimmedText(maxLength) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmedValue = value.trim();
      return trimmedValue === "" ? null : trimmedValue;
    },
    z.union([z.string().min(1).max(maxLength), z.null()]).optional(),
  );
}

const optionalHexColorSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? null : trimmedValue;
  },
  z.union([z.string().regex(hexColorPattern), z.null()]).optional(),
);

const createCourseBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: optionalTrimmedText(40),
  instructor: optionalTrimmedText(120),
  color: optionalHexColorSchema,
  term: optionalTrimmedText(80),
  targetGrade: optionalTrimmedText(20),
});

const updateCourseBodySchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    code: optionalTrimmedText(40),
    instructor: optionalTrimmedText(120),
    color: optionalHexColorSchema,
    term: optionalTrimmedText(80),
    targetGrade: optionalTrimmedText(20),
    isArchived: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided.",
  });

const courseParamsSchema = z.object({
  courseId: z.string().uuid(),
});

export const listCoursesSchema = z.object({
  body: z.any().optional(),
  params: z.object({}),
  query: z.object({
    status: courseStatusSchema.default("active"),
  }),
});

export const createCourseSchema = z.object({
  body: createCourseBodySchema,
  params: z.object({}),
  query: z.object({}),
});

export const courseIdSchema = z.object({
  body: z.any().optional(),
  params: courseParamsSchema,
  query: z.object({}),
});

export const updateCourseSchema = z.object({
  body: updateCourseBodySchema,
  params: courseParamsSchema,
  query: z.object({}),
});
