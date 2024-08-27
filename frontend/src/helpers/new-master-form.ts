import { Tags } from "../schema/master/master.schema";
import { MasterFormData } from "../schema/form/form.schema";

export function formatContactsForSchema(formData: MasterFormData) {
  if (!formData.telephone && !formData.instagram && !formData.telegram) {
    throw new Error("Invalid data: no contacts provided");
  }

  const formattedContacts = [];

  if (formData.telephone) {
    if (formData.isTelephone) {
      formattedContacts.push({
        contactType: "phone",
        value: formData.telephone,
      });
    }

    if (formData.isWhatsapp) {
      formattedContacts.push({
        contactType: "whatsapp",
        value: formData.telephone,
      });
    }

    if (formData.isViber) {
      formattedContacts.push({
        contactType: "viber",
        value: formData.telephone,
      });
    }
  }

  if (formData.instagram) {
    formattedContacts.push({
      contactType: "instagram",
      value: formData.instagram.trim(),
    });
  }

  if (formData.telegram) {
    formattedContacts.push({
      contactType: "telegram",
      value: formData.telegram.trim(),
    });
  }

  return formattedContacts;
}

export function formatTagsForSchema(formData: MasterFormData) {
  if (!formData || !formData.tags) {
    throw new Error("Invalid data: no tags provided");
  }

  const formattedTags: Tags = { ua: [], en: [] };
  formattedTags.ua = formData.tags.map((tag) => tag.value);

  return formattedTags;
}
