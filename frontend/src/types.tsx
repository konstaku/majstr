// export type User = {
//     telegramID: number;
//     token: string;
//     firstName: string;
//     lastName: string;
//     username: string;
//     photo: string | null;
//     isAdmin: boolean;
// };

// export type Contacts = {
//     contactType: string;
//     value: string;
// };

// export type Master = {
//     _id: string;
//     name: string;
//     professionID: string;
//     telegramID: number;
//     countryID: string;
//     locationID: string;
//     contacts: Contacts[];
//     about: string;
//     photo: string;
//     OGimage: string;
//     likes: number;
//     tags: Tags;
//     approved: boolean;
// };

// export type Country = {
//     id: string;
//     name: {
//         en: string;
//         ua: string;
//         ua_alt: string;
//         ru: string;
//         ru_alt: string;
//     };
//     flag: string;
// };

// export type Location = {
//     id: string;
//     countryID: string;
//     name: {
//         en: string;
//         ua: string;
//         ua_alt: string;
//         ru: string;
//         ru_alt: string;
//     };
// };

// export type Profession = {
//     id: string;
//     categoryID: string;
//     name: {
//         ua: string;
//         en: string;
//         ru: string;
//     };
// };

// export type ProfCategory = {
//     id: string;
//     name: {
//         en: string;
//         ua: string;
//         ru: string;
//     };
// };

// export type Tags = {
//     ua: string[];
//     en: string[];
// };

// export type State = {
//     masters: Master[];
//     locations: Location[];
//     professions: Profession[];
//     profCategories: ProfCategory[];
//     countries: Country[];
//     searchParams: {
//         selectedCity: string;
//         selectedProfession: string;
//         selectedProfessionCategory: string;
//     };
//     user: {
//         firstName: string;
//         username: string | undefined;
//         isLoggedIn: boolean;
//     };
//     countryID: string;
//     countrySet: boolean;
//     error: string;
// };

export type MasterFormData = {
  name: string;
  profCategoryID: string;
  professionID: string;
  locationID: string;
  tags: FormTag[];
  telephone: string;
  isTelephone: boolean;
  isWhatsapp: boolean;
  isViber: boolean;
  instagram: string;
  telegram: string;
  about: string;
  useThisPhoto: boolean;
};

export type FormTag = {
  label: string;
  value: string;
};

export type MasterPreviewType = {
  photo: string | null;
  watcher: MasterFormData;
};
