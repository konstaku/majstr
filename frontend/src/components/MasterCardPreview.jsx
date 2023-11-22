import professions from '../data/professions.json';
import locations from '../data/locations.json';
import Avatar from './Avatar';

export default function MasterCardPreview({ master }) {
  const { photo, watcher } = master;
  const { name, location, profession, tags, useThisPhoto } = watcher;

  return (
    <>
      <div className="master-card preview">
        <div
          className="master-card-body"
          style={{ backgroundColor: '#F3AB4735' }}
        >
          <div>
            <div className="master-card-header">
              <Avatar img={useThisPhoto && photo} color="#F3AB47" name={name} />
              <div className="bookmark-container">
                <img src="/img/icons/bookmark-passive.svg" alt="" />
              </div>
            </div>
            <div className="master-card-name">{name}</div>
            <div className="master-card-profession">
              {profession
                ? professions.find((p) => p.id === profession).name.ua
                : 'Професія невідома'}
            </div>
            <div className="mastercard-location">
              <img src="/img/icons/geopin.svg" alt="" />
              {location
                ? locations.find((l) => l.id === location).city.ua
                : 'Локація невідома'}
            </div>
          </div>
          <div className="mastercard-tag-container">
            {!!tags?.length &&
              tags
                .sort((a, b) => a.length - b.length)
                .map((tag, index) => (
                  <div key={index} className="mastercard-tag">
                    {tag.value.toLowerCase()}
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
