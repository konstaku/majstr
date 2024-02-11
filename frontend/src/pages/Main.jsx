import './../styles.css';

import { useContext, useEffect, useState } from 'react';
import Select from 'react-select';
import SearchResults from '../components/SearchResults';
import { MasterContext } from '../context';
import { ACTIONS } from '../reducer';
import Modal from '../components/Modal';
import { useNavigation } from 'react-router-dom';
import {
  trackClickOutsideCard,
  trackEscWhenModalShown,
} from '../helpers/modal';

function Main() {
  const { state, dispatch } = useContext(MasterContext);
  const {
    masters,
    professions,
    locations,
    countries,
    countryID,
    profCategories,
    searchParams,
    error,
  } = state;
  const { selectedCity, selectedProfessionCategory } = searchParams;
  const [showModal, setShowModal] = useState(null);
  const { state: loadingState } = useNavigation();
  const isLoading = loadingState === 'loading';
  const isError = false;

  const currentCountry = countries.find((country) => country.id === countryID);

  if (error) {
    throw new Error(error);
  }

  // Check for an open mastercard in search params on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modalCard = params.get('card');
    const masterIsValid = masters.find((master) => master.id === modalCard);

    console.log('modalCard:', modalCard, 'masterIsValid', masterIsValid);

    if (modalCard && masterIsValid) {
      setShowModal(modalCard);
    }
  }, []);

  console.log('state:', state);

  // Display master name in page title whenever modal pops
  // Track document clicks outside modal
  useEffect(() => {
    if (showModal) {
      document.addEventListener('click', (e) =>
        trackClickOutsideCard(e, 'details-modal', setShowModal)
      );
      document.addEventListener('keyup', (e) =>
        trackEscWhenModalShown(e, setShowModal)
      );

      const currentMaster = masters.find((master) => master._id === showModal);
      if (!currentMaster) return;

      const professionName = professions.find(
        (profession) => profession.id === currentMaster.professionID
      ).name.ua;
      const cityName = locations.find(
        (location) => location.id === currentMaster.locationID
      ).name.ua_alt;

      document.title = `${currentMaster.name} | ${professionName} в ${cityName}`;
    }
    return () => {
      document.removeEventListener('click', trackClickOutsideCard);
      document.removeEventListener('keyup', trackEscWhenModalShown);
      document.title = 'Majstr : Знаходь українських майстрів';
    };
  }, [showModal, masters]);

  // The first value is always an empty string, so the user can always return to "all" as an option
  // Then, I always display every location with at least one master in it
  const availableLocations = [
    {
      value: '',
      label: `Вся ${currentCountry?.name.ua}`,
    },
  ].concat(
    // Array of unique locations only
    [
      ...new Set(
        masters
          .filter((master) => master.countryID === countryID)
          .map((master) => master.locationID)
      ),
    ].map((masterLocationId) => ({
      value: masterLocationId,
      label: locations.find((location) => location.id === masterLocationId)
        ?.name.ua,
    }))
  );

  // Here I filter out unique proffessions for the selected city
  const availableProfessions =
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
    ];

  function generateProfessionsSelectOptions(professionList) {
    const result = [];

    result.push({
      // The first element is "Everyone", which is an empty string
      value: '',
      label: 'Всі майстри',
    });

    const uniqueProfessionCategories = [
      ...new Set(
        professionList.map((p) => getProfessionCategoryById(professions, p))
      ),
    ];

    const professionLabelList = uniqueProfessionCategories.map(
      (professionCategoryID) => ({
        value: professionCategoryID,
        label: profCategories.find(
          (profCategory) => profCategory.id === professionCategoryID
        )?.name.ua,
      })
    );

    result.push(...professionLabelList);
    return result;
  }

  const professionSelectOptions =
    generateProfessionsSelectOptions(availableProfessions);

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
              professionCategory={selectedProfessionCategory}
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
          selectedProfessionCategory
            ? professionSelectOptions.find(
                (p) => p.value === selectedProfessionCategory
              )
            : selectedProfessionCategory
        }
        unstyled
        // options={availableProfessions}
        options={professionSelectOptions}
        styles={headlineSelectStyles}
        placeholder="Всі майстри"
        onChange={(e) =>
          dispatch({
            type: ACTIONS.SET_PROFESSION,
            payload: { selectedProfessionCategory: e.value },
          })
        }
      />
    );
  }

  function isModalMaster(id) {
    return masters.find((master) => master._id === id);
  }
}

function getProfessionCategoryById(professions, professionID) {
  return professions.find((p) => p.id === professionID)?.categoryID;
}

export const mainRoute = {
  // loader,
  element: <Main />,
};
