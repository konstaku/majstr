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

// Setting styles for select elements
export const baseSelectStyles = {
  singleValue: (base) => ({ ...base, color: 'white' }),
  menu: (base) => ({
    ...base,
    backgroundColor: '#171923',
    borderRadius: '1rem',
    overflow: 'hidden',
  }),
  valueContainer: (base) => ({
    ...base,
    background: '#171923',
    color: 'white',
    width: '100%',
    margin: '1rem',
    maxWidth: '300px',
  }),
  option: (base, state) => ({
    ...base,
    padding: '1rem',
    cursor: 'pointer',
    paddingTop: '0.5rem',
    paddingBottom: '0.5rem',
    borderRadius: '10px',
    backgroundColor: state.isFocused ? '#4fd1c5' : '#171923',
  }),
  control: (base) => ({
    ...base,
    cursor: 'pointer',
  }),
};

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
    countrySet,
  } = state;
  const { selectedCity, selectedProfessionCategory } = searchParams;
  const [showModal, setShowModal] = useState(null);
  const { state: loadingState } = useNavigation();
  const isLoading = loadingState === 'loading';
  const isError = false; // Need to add state

  const currentCountry = countries.find((country) => country.id === countryID);

  if (error) {
    throw new Error(error);
  }

  // Check for an open mastercard in search params on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modalCard = params.get('card');
    if (!modalCard) return;

    const masterIsValid = masters.find((master) => master._id === modalCard);
    if (modalCard && masterIsValid) {
      setShowModal(modalCard);
    }
  }, [masters]);

  // Display master name in page title whenever modal pops
  // Track document clicks outside modal
  useEffect(() => {
    const clickListener = (e) =>
      trackClickOutsideCard(e, 'details-modal', setShowModal);
    const keyUpListener = (e) => trackEscWhenModalShown(e, setShowModal);

    if (showModal) {
      const currentMaster = masters.find((master) => master._id === showModal);
      if (!currentMaster) return;

      document.addEventListener('click', clickListener);
      document.addEventListener('keyup', keyUpListener);

      const professionName = professions.find(
        (profession) => profession.id === currentMaster.professionID
      ).name.ua;
      const cityName = locations.find(
        (location) => location.id === currentMaster.locationID
      ).name.ua_alt;

      document.title = `${currentMaster.name} | ${professionName} в ${cityName}`;
    }

    return () => {
      if (showModal) {
        document.removeEventListener('click', clickListener);
        document.removeEventListener('keyup', keyUpListener);
      }
      document.title = 'Majstr : Знаходь українських майстрів';
    };
  }, [showModal, masters]);

  // The first value is always an empty string, so the user can always return to "all" as an option
  // Then, I always display every location with at least one master in it
  const locationPlaceholder = currentCountry
    ? {
        value: '',
        label: `Вся ${currentCountry?.name.ua}`,
      }
    : { value: '', label: '🤔 🤔 🤔' };
  const availableLocations = [locationPlaceholder].concat(
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
        ?.name.ua_alt,
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
        isSearchable={false}
        defaultValue={
          selectedCity
            ? availableLocations.find((l) => l.value === selectedCity)
            : availableLocations[0]
        }
        options={availableLocations}
        styles={{
          ...baseSelectStyles,
          valueContainer: (base) => ({
            ...base,
            minWidth: '150px',
          }),
        }}
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
        isSearchable={false}
        // options={availableProfessions}
        options={professionSelectOptions}
        styles={baseSelectStyles}
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
