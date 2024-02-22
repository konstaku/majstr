import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { colorPalette } from './MasterCard';
import Avatar from './Avatar';
import { MasterContext } from '../context';
import ContactsLayout from './ContactsLayout';

export default function Modal({ master, setShowModal }) {
  const {
    state: { locations, professions },
  } = useContext(MasterContext);

  const { _id: id } = master;
  const [copyUrl, setCopyUrl] = useState(null);

  // I am using last two digits of an ID to derive a pseudorandom color for a card
  const randomAvatarColor = useMemo(() => {
    const seed = parseInt(id.slice(-2), 16) % colorPalette.length;
    return colorPalette[seed];
  }, [id]);

  // Add card ID to address string, remove at unmount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('card', id);
    window.history.pushState({}, '', `${window.location.pathname}?${params}`);

    return () => {
      const params = new URLSearchParams(window.location.search);
      params.delete('card');
      window.history.pushState({}, '', `${window.location.pathname}`);
    };
  }, []);

  async function copyUrlToClipboard(id) {
    const url = `https://majstr.com/?card=${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyUrl(url);
    } catch (err) {
      console.error('Failed to copy text to clipboard', err);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-overlay-inside">
        <div className="modal-content" id="details-modal">
          <div
            className="master-card-body modal"
            style={{ backgroundColor: randomAvatarColor + '35' }}
          >
            <div>
              <div className="master-card-header">
                <Avatar
                  img={master.photo}
                  color={randomAvatarColor}
                  name={master.name}
                />
                <div className="share-close-container">
                  <div
                    className={`share-container ${copyUrl && 'confirm'}`}
                    onClick={() => copyUrlToClipboard(id)}
                  >
                    <img
                      src={`/img/icons/${copyUrl ? 'ok' : 'share'}.svg`}
                      alt="share"
                    />
                  </div>
                  <div
                    className="close-container"
                    onClick={() => setShowModal(null)}
                  >
                    <img src="/img/icons/close.svg" alt="close" />
                  </div>
                </div>
              </div>
              <div className="master-card-name">{master.name}</div>
              <div className="master-card-profession">
                {professions.find((p) => p.id === master.professionID).name.ua}
              </div>
              <div className="mastercard-location">
                <img src="/img/icons/geopin.svg" alt="" />
                {locations.find((l) => l.id === master.locationID).name.ua}
              </div>
              <div className="mastercard-about">
                <pre className="about-pre">
                  {master.about
                    ? master.about
                    : `Нажаль, майстер немає детального опису 🤷‍♂️`}
                </pre>
              </div>
            </div>
            <ContactsLayout contacts={master.contacts} />
          </div>
        </div>
      </div>
    </div>
  );
}
