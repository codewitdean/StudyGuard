import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email()
  .transform((email) => email.toLowerCase());

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
