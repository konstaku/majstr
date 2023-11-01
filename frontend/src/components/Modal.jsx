import professions from '../data/professions.json';
import locations from '../data/locations.json';
import { useCallback, useMemo } from 'react';
import { colorPalette } from './MasterCard';
import Avatar from './Avatar';

export default function Modal({ id, master, setShowModal }) {
  if (!id) return null;

  const randomAvatarColor = useMemo(() => {
    // I am using last two digits of an ID to derive a pseudorandom color for a card
    const seed = parseInt(id.slice(-2), 16) % colorPalette.length;
    return colorPalette[seed];
  }, [id]);

  const generateContactLayout = useCallback(({ contactType, value }, index) => {
    let contactValue;
    let link;

    switch (contactType) {
      case 'instagram':
        link = `https://www.instagram.com/${value}/`;
        contactValue = <a href={link}>{value}</a>;
        break;
      case 'telegram':
        const handle = value.replace(/@/g, '');
        link = `https://t.me/${handle}`;
        contactValue = <a href={link}>{value}</a>;
        break;
      case 'phone':
        contactValue = <a href={`tel:${value}`}>{value}</a>;
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
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-overlay-inside">
        <div className="modal-content" id="details-modal">
          <div
            className="master-card-body modal"
            style={{ backgroundColor: randomAvatarColor + '35' }}
          >
            <div className="master-card-header">
              <Avatar
                img={master.photo}
                color={randomAvatarColor}
                name={master.name}
              />
              <div
                className="close-container"
                onClick={() => setShowModal(null)}
              >
                <img
                  src="/img/icons/close.svg"
                  alt="close"
                  style={{ width: '12px', height: '12px' }}
                />
              </div>
            </div>
            <div className="master-card-name">{master.name}</div>
            <div className="master-card-profession">
              {professions.find((p) => p.id === master.professionID).name.ua}
            </div>
            <div className="mastercard-location">
              <img src="/img/icons/geopin.svg" alt="" />
              {locations.find((l) => l.id === master.locationID).city.ua}
            </div>

            <div className="mastercard-about">{master.about}</div>

            <div className="mastercard-contacts">
              {master.contacts.map(generateContactLayout)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
