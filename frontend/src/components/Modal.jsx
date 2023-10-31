import { Avatar, Typography } from 'antd';
const { Text } = Typography;
import professions from '../data/professions.json';
import locations from '../data/locations.json';
import { useCallback } from 'react';

export default function Modal({ id, master }) {
  if (!id) return null;

  console.log(id);

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
        <Text type="secondary">{contactType}: </Text>
        <Text type="primary">{contactValue}</Text>
      </div>
    );
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-overlay-inside">
        <div className="modal-content" id="details-modal">
          <div
            className="master-card-body modal"
            style={{ backgroundColor: '#A0E4CB35' }}
          >
            <div className="master-card-header">
              <Avatar
                src={master.photo && master.photo}
                style={
                  !master.photo && {
                    backgroundColor: '#A0E4CB',
                  }
                }
                className="card-avatar"
              >
                {master.name[0]}
              </Avatar>
              <div className="bookmark-container">
                <img
                  src="/img/icons/close.svg"
                  alt=""
                  style={{ width: '12px', height: '12px', opacity: '0.7' }}
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
