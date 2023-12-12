export function formatContactsForSchema(formData) {
  if (!formData.telephone && !formData.instagram && !formData.telegram) {
    throw new Error('Invalid data: no contacts provided');
  }

  const formattedContacts = [];

  if (formData.telephone) {
    formData.isTelephone &&
      formattedContacts.push({
        contactType: 'phone',
        value: formData.telephone,
      });
    formData.isWhatsapp &&
      formattedContacts.push({
        contactType: 'whatsapp',
        value: formData.telephone,
      });
    formData.isViber &&
      formattedContacts.push({
        contactType: 'viber',
        value: formData.telephone,
      });
  }

  if (formData.instagram) {
    formattedContacts.push({
      contactType: 'instagram',
      value: formData.instagram,
    });
  }
  if (formData.telegram) {
    formattedContacts.push({
      contactType: 'telegram',
      value: formData.telegram,
    });
  }

  return formattedContacts;
}

export function formatTagsForSchema(formData) {
  if (!formData || !formData.tags) {
    throw new Error('Invalid data: no tags provided');
  }

  const formattedTags = {};
  formattedTags.ua = formData.tags.map((tag) => tag.value);

  return formattedTags;
}
