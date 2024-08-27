import { z } from "zod";
import { UserSchema } from "./user.schema";

export type User = z.infer<typeof UserSchema>;
