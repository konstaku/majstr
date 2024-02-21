import {
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
} from 'react';
import { useLoaderData } from 'react-router-dom';
import { MasterContext } from '../context';
import Avatar from '../components/Avatar';
import ContactsLayout from '../components/ContactsLayout';
import { ACTIONS } from '../reducer';

function Admin() {
  const newMasters = useLoaderData();
  const [token] = useState(() => JSON.parse(localStorage.getItem('token')));
  const {
    state: { locations, professions },
  } = useContext(MasterContext);

  return (
    <div className="search-results-container">
      <div className="search-results-header">
        <h2>Нових майстрів:</h2>
        <span className="found-amount">{newMasters.length}</span>
      </div>
      {newMasters.map((master, i) => (
        <NewMasterPreview
          key={i}
          master={master}
          token={token}
          locations={locations}
          professions={professions}
        />
      ))}
    </div>
  );
}

function NewMasterPreview({ master, token, professions }) {
  console.log('master:', master);
  const { _id, name, tags, contacts, about, locationID, professionID } = master;

  return (
    <div className="master-card" id={_id}>
      <div
        className="master-card-body"
        style={{ backgroundColor: '8080ff' + '35' }}
      >
        <div>
          <div className="master-card-header">
            <Avatar img={master.photo} color={'8080ff'} name={name} />
            <div className="bookmark-container">
              <img src="/img/icons/bookmark-passive.svg" alt="" />
            </div>
          </div>
          <div className="master-card-name">{name}</div>
          <div className="master-card-profession">
            {professions?.find((p) => p.id === professionID)?.name.ua}
          </div>
          <div className="mastercard-location">
            <img src="/img/icons/geopin.svg" alt="" />
            {locationID}
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
        <ContactsLayout contacts={contacts} />
      </div>
      <div className="master-card-footer">
        <button
          className="btn admin"
          onClick={() => approveMaster('approve', _id, token)}
        >
          ✅
        </button>
        <button
          className="btn admin"
          onClick={() => approveMaster('decline', _id, token)}
        >
          ❌
        </button>
      </div>
    </div>
  );

  async function approveMaster(action, masterID, token) {
    const masterData = {
      action,
      masterID,
      token,
    };

    const controller = new AbortController();

    await fetch('https://api.majstr.com/approve-master', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(masterData),
      signal: controller.signal,
    })
      .then((response) => {
        if (response.ok) {
          return true;
        }
        return Promise.reject(response);
      })
      .catch(console.error);
  }
}

function loader({ request }) {
  return fetch('https://api.majstr.com/?q=newmasters', {
    signal: request.signal,
  });
}

export const adminRoute = {
  element: <Admin />,
  loader,
};
