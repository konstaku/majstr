import { z } from "zod";

export const FormTagSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const MasterFormDataSchema = z.object({
  name: z.string(),
  profCategoryID: z.string(),
  professionID: z.string(),
  locationID: z.string(),
  tags: z.array(FormTagSchema),
  telephone: z.string(),
  isTelephone: z.boolean(),
  isWhatsapp: z.boolean(),
  isViber: z.boolean(),
  instagram: z.string(),
  telegram: z.string(),
  about: z.string(),
  useThisPhoto: z.boolean(),
});

export const MasterPreviewSchema = z.object({
  photo: z.string().nullable(),
  watcher: MasterFormDataSchema,
});

export type FormTag = z.infer<typeof FormTagSchema>;
export type MasterFormData = z.infer<typeof MasterFormDataSchema>;
export type MasterPreviewType = z.infer<typeof MasterPreviewSchema>;
