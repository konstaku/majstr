import { z } from "zod";
import { ContactSchema, MasterSchema, TagsSchema } from "./master.schema";

export type Master = z.infer<typeof MasterSchema>;
export type Tags = z.infer<typeof TagsSchema>;
export type Contacts = z.infer<typeof ContactSchema>;
