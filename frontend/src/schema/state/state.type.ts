import { z } from "zod";
import {
    CountrySchema,
    LocationSchema,
    ProfCategorySchema,
    ProfessionSchema,
    StateSchema,
} from "./state.schema";

export type State = z.infer<typeof StateSchema>;
export type Country = z.infer<typeof CountrySchema>;
export type Location = z.infer<typeof LocationSchema>;
export type Profession = z.infer<typeof ProfessionSchema>;
export type ProfCategory = z.infer<typeof ProfCategorySchema>;
