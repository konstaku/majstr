import { Avatar, Collapse, Typography } from 'antd';
import professions from '../data/professions.json';
import locations from '../data/locations.json';
import { useCallback, useMemo, useRef } from 'react';
const { Text } = Typography;

const colorPalette = [
  '#F94C66', // coral
  '#F37D5D', // pumpkin
  '#FBB13C', // yellow
  '#FCD34D', // dandelion
  '#BCE784', // green
  '#63B2AF', // teal
  '#5E9FE0', // sky
  '#DF73FF', // magenta
  '#B671F6', // purple
  '#F49AC1', // pink
  '#EF5B5B', // red
  '#FF842D', // orange
  '#E9777D', // rose
  '#FFCF48', // sunflower
  '#F3AB47', // gold
  '#A0E4CB', // turquoise
  '#9DF1DF', // mint
  '#D599FF', // lilac
  '#B5B2FF', // periwinkle
];

export default function MasterCardNew({ master }) {
  const { name, professionID, locationID, contacts, about, likes, tags } =
    master;
  const photoRef = useRef(master.photo);
  const randomBackgroundColor = useMemo(
    () => colorPalette[Math.floor(Math.random() * colorPalette.length)],
    []
  );

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
    <div className="master-card">
      <div
        className="master-card-body"
        style={{ backgroundColor: randomBackgroundColor + '35' }}
      >
        <div>
          <div className="master-card-header">
            <Avatar
              src={photoRef.current && photoRef.current}
              style={
                !photoRef.current && { backgroundColor: randomBackgroundColor }
              }
              className="card-avatar"
            >
              {name[0]}
            </Avatar>
            <div className="bookmark-container">
              <img src="/img/icons/bookmark-passive.svg" alt="" />
            </div>
          </div>
          <div className="master-card-name">{name}</div>
          <div className="master-card-profession">
            {professions.find((p) => p.id === professionID).name.ua}
          </div>
          <div className="mastercard-location">
            <img src="/img/icons/geopin.svg" alt="" />
            {locations.find((l) => l.id === locationID).city.ua}
          </div>
        </div>
        <div className="mastercard-tag-container">
          {tags.ua
            .sort((a, b) => a.length - b.length)
            .map((tag, index) => (
              <div key={index} className="mastercard-tag">
                {tag}
              </div>
            ))}
        </div>
      </div>
      <div className="master-card-footer">
        <button className="details">Детальніше</button>
      </div>
    </div>
  );
}
