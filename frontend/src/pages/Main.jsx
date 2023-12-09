import './../styles.css';
import locations from '../data/locations.json';
import professions from '../data/professions.json';

import { useContext, useEffect, useState } from 'react';
import Select from 'react-select';
import SearchResults from '../components/SearchResults';
import { MasterContext } from '../context';
import { ACTIONS } from '../reducer';
import Modal from '../components/Modal';
import { useLoaderData, useNavigation } from 'react-router-dom';

function Main() {
  const masters = useLoaderData();
  const { state, dispatch } = useContext(MasterContext);
  const { searchParams } = state;
  const { selectedCity, selectedProfession } = searchParams;
  const [showModal, setShowModal] = useState(null);
  const { state: loadingState } = useNavigation();
  const isLoading = loadingState === 'loading';
  const isError = false;

  // Check for an open mastercard in search params on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modalCard = params.get('card');

    if (modalCard) {
      setShowModal(modalCard);
    }
  }, []);

  // Display master name in page title whenever modal pops
  // Track document clicks outside modal
  useEffect(() => {
    if (showModal) {
      document.addEventListener('click', trackClickOutsideCard);
      document.addEventListener('keyup', trackEscWhileFlipped);

      const currentMaster = masters.find((master) => master._id === showModal);
      if (!currentMaster) return;

      const professionName = professions.find(
        (profession) => profession.id === currentMaster.professionID
      ).name.ua;
      const cityName = locations.find(
        (location) => location.id === currentMaster.locationID
      ).city.ua_alt;

      document.title = `${currentMaster.name} | ${professionName} в ${cityName}`;
    }
    return () => {
      document.removeEventListener('click', trackClickOutsideCard);
      document.removeEventListener('keyup', trackEscWhileFlipped);
      document.title = 'Majstr : Знаходь українських майстрів';
    };
  }, [showModal, masters]);

  // The first value is always an empty string, so the user can always return to "all" as an option
  // Then, I always display every location with at least one master in it
  const availableLocations = [
    {
      value: '',
      label: 'Вся Італія',
    },
  ].concat(
    // Array of unique locations only
    [...new Set(masters.map((master) => master.locationID))].map(
      (masterLocationId) => ({
        value: masterLocationId,
        label: locations.find((location) => location.id === masterLocationId)
          .city.ua,
      })
    )
  );

  // Here I filter out unique proffessions for the selected city
  const availableProfessions = [
    {
      // The first element is "Everyone", which is an empty string
      value: '',
      label: 'Всі майстри',
    },
  ].concat(
    // Array of unique proffessions
    [
      ...new Set(
        masters
          .filter((master) => {
            if (selectedCity) {
              // If a city is selected, display unique proffessions for that city
              return master.locationID === selectedCity;
            }
            // Otherwise display unique proffessions from all cities
            return true;
          })
          .map((master) => master.professionID)
      ),
    ].map((masterProffessionId) => ({
      value: masterProffessionId,
      label: professions.find(
        (profession) => profession.id === masterProffessionId
      ).name.ua,
    }))
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
            {/* The modal is shown conditionally, when there is someone to show */}
            {showModal && isModalMaster(showModal) && (
              <Modal
                // id={showModal}
                master={isModalMaster(showModal)}
                setShowModal={setShowModal}
              ></Modal>
            )}
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
            : availableLocations[0]
        }
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

  function isModalMaster(id) {
    return masters.find((master) => master._id === id);
  }
}

async function loader({ request: { signal } }) {
  const response = await fetch('https://api.majstr.com/?q=masters', { signal });
  if (response.status === 200) {
    return await response.json();
  }
  throw new Response((`Error ${response.status}`, { status: response.status }));
}

export const mainRoute = {
  loader,
  element: <Main />,
};
