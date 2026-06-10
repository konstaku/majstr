// Static API fixtures shaped like the real backend responses (see
// backend/routes/public.js and frontend/src/schema/*). _ids are valid
// ObjectIds whose timestamp prefix is recent enough for the NEW-badge logic.

const name = (en: string, ua: string, ru = ua) => ({ en, ua, ru });

export const profCategories = [
  { _id: "684700000000000000000101", id: "construction", name: name("Construction", "Будівництво") },
  { _id: "684700000000000000000102", id: "beauty", name: name("Beauty", "Краса") },
];

export const professions = [
  { _id: "684700000000000000000201", id: "electrician", categoryID: "construction", name: name("Electrician", "Електрик") },
  { _id: "684700000000000000000202", id: "plumber", categoryID: "construction", name: name("Plumber", "Сантехнік") },
  { _id: "684700000000000000000203", id: "seamstress", categoryID: "beauty", name: name("Seamstress", "Швачка") },
];

const locName = (en: string, ua: string, ru = ua) => ({
  en,
  ua,
  ua_alt: ua,
  ru,
  ru_alt: ru,
});

export const locations = [
  { _id: "684700000000000000000301", id: "milan", countryID: "IT", name: locName("Milan", "Мілан") },
  { _id: "684700000000000000000302", id: "rome", countryID: "IT", name: locName("Rome", "Рим") },
];

export const countries = [
  { _id: "684700000000000000000401", id: "IT", flag: "🇮🇹", name: locName("Italy", "Італія") },
];

const master = (
  id: string,
  fields: { name: string; professionID: string; locationID: string; about: string }
) => ({
  _id: id,
  ...fields,
  telegramID: 100000 + Number(id.slice(-2)),
  countryID: "IT",
  contacts: [{ contactType: "phone", value: "+39 333 1234567" }],
  photo: null,
  OGimage: "",
  likes: 0,
  tags: { ua: ["якісно"], en: ["quality"] },
  languages: ["uk", "it"],
  availability: "available",
  status: "approved",
  approved: true,
  claimable: false,
  rating: 4.8,
  reviewCount: 3,
});

export const masters = [
  master("684700000000000000000501", {
    name: "Олена Швачка",
    professionID: "seamstress",
    locationID: "milan",
    about: "Шию та ремонтую одяг у Мілані.",
  }),
  master("684700000000000000000502", {
    name: "Іван Сантехнік",
    professionID: "plumber",
    locationID: "rome",
    about: "Сантехнічні роботи в Римі.",
  }),
  master("684700000000000000000503", {
    name: "Петро Електрик",
    professionID: "electrician",
    locationID: "milan",
    about: "Електромонтаж у Мілані.",
  }),
];
