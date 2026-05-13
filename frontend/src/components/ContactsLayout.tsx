import type { Contacts } from "../schema/master/master.schema";

type ContactsLayoutProps = { contacts: Contacts[] };

const CONTACT_ICONS: Record<string, string> = {
  telegram: "✈️",
  instagram: "📸",
  phone: "📞",
  facebook: "👤",
};

export default function ContactsLayout({ contacts }: ContactsLayoutProps) {
  if (!contacts.length) return null;

  return (
    <div className="contact-btns">
      {contacts.map((contact, index) => {
        const { contactType, value } = contact;
        let href = "#";

        switch (contactType) {
          case "telegram":
            href = `https://t.me/${value.replace(/@/g, "")}`;
            break;
          case "instagram":
            href = `https://www.instagram.com/${value}/`;
            break;
          case "phone":
            href = `tel:${value}`;
            break;
          case "facebook":
            href = value;
            break;
        }

        const isPrimary = index === 0;

        return (
          <a
            key={index}
            href={href}
            className={`contact-btn-link ${isPrimary ? "primary" : "secondary"}`}
            target={contactType !== "phone" ? "_blank" : undefined}
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <span>{CONTACT_ICONS[contactType] ?? "💬"}</span>
            <span style={{ textTransform: "capitalize" }}>{contactType}</span>
          </a>
        );
      })}
    </div>
  );
}
