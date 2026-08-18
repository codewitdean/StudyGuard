import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
    email: z
      .string()
      .trim()
      .email()
      .transform((email) => email.toLowerCase()),
    password: z.string().min(8).max(72),
  }),
  params: z.object({}),
  query: z.object({}),
});
