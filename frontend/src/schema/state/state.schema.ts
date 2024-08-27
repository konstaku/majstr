import { z } from "zod";
import { MasterSchema } from "../master/master.schema";
import { UserSchema } from "../user/user.schema";

export const ProfessionSchema = z.object({
    id: z.string(),
    categoryID: z.string(),
    name: z.object({
        ua: z.string(),
        en: z.string(),
        ru: z.string(),
    }),
});

export const ProfCategorySchema = ProfessionSchema.omit({ categoryID: true });

export const LocationNameSchema = z.object({
    en: z.string(),
    ua: z.string(),
    ua_alt: z.string(),
    ru: z.string(),
    ru_alt: z.string(),
});

export const LocationSchema = z.object({
    id: z.string(),
    name: LocationNameSchema,
    countryID: z.string(),
});

export const CountrySchema = LocationSchema.omit({ countryID: true }).extend({
    flag: z.string(),
});

export const StateSchema = z.object({
    masters: z.array(MasterSchema),
    locations: z.array(LocationSchema),
    professions: z.array(ProfessionSchema),
    profCategories: z.array(ProfCategorySchema),
    countries: z.array(CountrySchema),
    searchParams: z.object({
        selectedCity: z.string(),
        selectedProfession: z.string(),
        selectedProfessionCategory: z.string(),
    }),
    user: UserSchema.pick({
        firstName: true,
        username: true,
        photo: true,
        lastName: true,
    }).extend({
        isLoggedIn: z.boolean(),
    }),
    countryID: z.string(),
    countrySet: z.boolean(),
    error: z.string(),
});
