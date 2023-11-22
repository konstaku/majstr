import professions from '../data/professions.json';
import locations from '../data/locations.json';
import { useMemo, useRef } from 'react';
import Avatar from './Avatar';

export const colorPalette = [
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

export default function MasterCard({ master, showModal, setShowModal }) {
  const { _id, name, professionID, locationID, contacts, about, likes, tags } =
    master;

  // Null if no photo. Used for conditional rendering of avatar or first lettar of the name
  const photoRef = useRef(master.photo);

  const randomAvatarColor = useMemo(() => {
    // I am using last two digits of an ID to derive a pseudorandom color for a card
    const seed = parseInt(_id.slice(-2), 16) % colorPalette.length;
    return colorPalette[seed];
  }, [_id]);

  return (
    <>
      <div className="master-card" id={_id}>
        <div
          className="master-card-body"
          style={{ backgroundColor: randomAvatarColor + '35' }}
        >
          <div>
            <div className="master-card-header">
              <Avatar
                img={photoRef.current}
                color={randomAvatarColor}
                name={name}
              />
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
          <button className="details" onClick={() => setShowModal(_id)}>
            Детальніше
          </button>
        </div>
      </div>
    </>
  );
}
