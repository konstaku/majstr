import { z } from "zod";

export const ContactSchema = z.object({
  contactType: z.string(),
  value: z.string(),
});

export const TagsSchema = z.object({
  ua: z.array(z.string()),
  en: z.array(z.string()),
});

export const MasterSchema = z.object({
  _id: z.string(),
  name: z.string(),
  professionID: z.string(),
  telegramID: z.number(),
  countryID: z.string().default("IT"),
  locationID: z.string(),
  contacts: z.array(ContactSchema),
  about: z.string(),
  photo: z.string().nullable(),
  OGimage: z.string().nullable(),
  likes: z.number().default(0),
  tags: TagsSchema,
  isAdmin: z.boolean().default(false),
});

export type Master = z.infer<typeof MasterSchema>;
export type Tags = z.infer<typeof TagsSchema>;
export type Contacts = z.infer<typeof ContactSchema>;
