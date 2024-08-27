import { ReactElement } from "react";
import type { Contacts } from "../schema/master/master.schema";

type ContactsLayoutProps = { contacts: Contacts[] };

export default function ContactsLayout({ contacts }: ContactsLayoutProps) {
  return (
    <div className="mastercard-contacts">
      {contacts.map(generateContactLayout)}
    </div>
  );

  function generateContactLayout(
    { contactType, value }: Contacts,
    index: number
  ): JSX.Element {
    let contactValue: string | ReactElement;
    let link: string;

    switch (contactType) {
      case "instagram":
        link = `https://www.instagram.com/${value}/`;
        contactValue = <a href={link}>{value}</a>;
        break;
      case "telegram": {
        const handle = value.replace(/@/g, "");
        link = `https://t.me/${handle}`;
        contactValue = <a href={link}>{value}</a>;
        break;
      }
      case "phone":
        contactValue = <a href={`tel:${value}`}>{value}</a>;
        break;
      case "facebook":
        contactValue = <a href={value}>link</a>;
        break;
      default:
        contactValue = value;
    }

    return (
      <div key={index}>
        <span className="contact-name">{contactType}:</span>
        <span className="contact-value">{contactValue}</span>
      </div>
    );
  }
}
