import { z } from "zod";

const planningPriorityValues = [
  "meet_deadlines",
  "prevent_burnout",
  "balance_deadlines_wellbeing",
  "custom",
];

const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((email) => email.toLowerCase());

const updateCurrentUserBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    planningPriority: z.enum(planningPriorityValues).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one profile field is required.",
  });

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    email: emailSchema,
    password: z.string().min(8).max(72),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1).max(72),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const updateCurrentUserSchema = z.object({
  body: updateCurrentUserBodySchema,
  params: z.object({}),
  query: z.object({}),
});
