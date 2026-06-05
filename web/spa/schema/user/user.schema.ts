import { z } from "zod";

export const UserSchema = z.object({
  telegramID: z.number(),
  token: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  username: z.string(),
  photo: z.string().nullable(),
  isAdmin: z.boolean().default(false),
});

export type User = z.infer<typeof UserSchema>;
