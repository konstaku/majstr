import './../styles.css';
import locations from '../data/locations.json';
import professions from '../data/professions.json';

import { useContext, useEffect, useState } from 'react';
import Select from 'react-select';
import SearchResults from '../components/SearchResults';
import Modal from '../components/Modal';
import { MasterContext } from '../context';
import { ACTIONS } from '../reducer';

export default function Main() {
  const { state, dispatch } = useContext(MasterContext);

  // const [selectedProfession, setSelectedProfession] = useState('');
  const [showModal, setShowModal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  // const [loggedIn, setLoggedIn] = useState(false);

  const { masters, searchParams } = state;
  const { selectedCity, selectedProfession } = searchParams;

  // Check if a user is authenticated on load
  useEffect(() => {
    dispatch({ type: ACTIONS.LOGOUT });

    // It is important to JSON parse token in order to get rid of double quotes
    const token = JSON.parse(localStorage.getItem('token'));

    if (token) {
      const authenticateUser = async () => {
        fetch('https://api.konstaku.com:5000/auth', {
          headers: { Authorization: token },
        })
          .then((response) => {
            if (response.ok) {
              return response.json();
            } else {
              return Promise.reject(response);
            }
          })
          .then((result) => {
            dispatch({ type: ACTIONS.LOGIN, payload: { user: result } });
            console.log(`User ${result.firstName} logged in!`);
          })
          .catch(console.error);
      };

      authenticateUser();
    }
  }, []);

  // Fetch masters from backend on page load
  useEffect(() => {
    setIsLoading(true);
    setIsError(false);

    const controller = new AbortController();

    const fetchMasters = async () => {
      fetch('https://api.konstaku.com:5000/?q=masters', {
        signal: controller.signal,
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          } else {
            return Promise.reject(response);
          }
        })
        .then((result) =>
          dispatch({ type: ACTIONS.POPULATE, payload: { masters: result } })
        )
        .catch((error) => {
          if (error.name === 'AbortError') return;
          console.error(error);
          setIsError(true);
        })
        .finally(() => setIsLoading(false));
    };

    fetchMasters();

    return () => {
      controller.abort();
    };
  }, []);

  // Track document clicks whenever modal pops
  useEffect(() => {
    if (showModal) {
      document.addEventListener('click', trackClickOutsideCard);
      document.addEventListener('keyup', trackEscWhileFlipped);
    }
    return () => {
      document.removeEventListener('click', trackClickOutsideCard);
      document.removeEventListener('keyup', trackEscWhileFlipped);
    };
  }, [showModal]);

  const availableMasters = getAvailableMastersForCity(masters, selectedCity);
  const availableLocations = getAvailableLocations(masters);
  const availableProfessions = getAvailableProffessions(
    availableMasters,
    professions
  );

  // Setting styles for select elements
  const headlineSelectStyles = {
    singleValue: (base) => ({ ...base, color: 'white' }),
    menu: (base) => ({
      ...base,
      backgroundColor: '#171923',
      borderRadius: '20px',
      padding: '1rem',
    }),
    valueContainer: (base) => ({
      ...base,
      background: '#171923',
      color: 'white',
      width: '100%',
      margin: '1rem',
    }),
  };

  return (
    <>
      <div className="search-field">
        <span className="search-left">
          Я мешкаю в
          <SearchLocation />
        </span>
        <span className="search-right">
          та шукаю <SearchProffession />
        </span>
      </div>

      <div className="search-results-container">
        {isLoading ? (
          <div className="search-results-header">
            <h2>Шукаємо...</h2>
          </div>
        ) : isError ? (
          <div className="search-results-header">
            <h2>Неможливо виконати запит</h2>
          </div>
        ) : (
          <>
            <SearchResults
              masters={masters}
              city={selectedCity}
              profession={selectedProfession}
              showModal={showModal}
              setShowModal={setShowModal}
            />
            <Modal
              id={showModal}
              master={masters.find((master) => master._id === showModal)}
              setShowModal={setShowModal}
            ></Modal>
          </>
        )}
      </div>
    </>
  );

  function SearchLocation() {
    return (
      <Select
        className="headline-select"
        unstyled
        defaultValue={
          selectedCity
            ? availableLocations.find((l) => l.value === selectedCity)
            : selectedCity
        }
        placeholder="Вся Італія"
        options={availableLocations}
        styles={headlineSelectStyles}
        onChange={(e) => {
          dispatch({
            type: ACTIONS.SET_CITY,
            payload: { selectedCity: e.value },
          });
        }}
      />
    );
  }

  function SearchProffession() {
    return (
      <Select
        className="headline-select"
        defaultValue={
          selectedProfession
            ? availableProfessions.find((p) => p.value === selectedProfession)
            : selectedProfession
        }
        unstyled
        options={availableProfessions}
        styles={headlineSelectStyles}
        placeholder="Всі майстри"
        onChange={(e) =>
          dispatch({
            type: ACTIONS.SET_PROFESSION,
            payload: { selectedProfession: e.value },
          })
        }
      />
    );
  }

  function trackClickOutsideCard(event) {
    const modalCard = document.getElementById('details-modal');
    const target = event.target;

    if (target.contains(modalCard)) {
      console.log('target.contains(modalCard)');
      setShowModal(null);
    }
  }

  function trackEscWhileFlipped(event) {
    if (event.key === 'Escape') {
      setShowModal(null);
    }
  }
}

function getAvailableMastersForCity(masterList, city) {
  return masterList.filter((master) => master.locationID.includes(city));
}

function getAvailableLocations(masters) {
  return [...new Set(masters.map((master) => master.locationID))].map(
    (location) => ({
      value: location,
      label: locations.find((l) => l.id === location).city.ua_alt,
    })
  );
}

function getAvailableProffessions(availableMasters, professions) {
  return [
    ...new Set(availableMasters.map((master) => master.professionID)),
  ].map((professionID) => ({
    value: professionID,
    label: professions.find((p) => p.id === professionID).name.ua,
  }));
}
