import { lazy, useEffect, useState } from 'react';
import locations from '../data/locations.json';
import professions from '../data/professions.json';
import Select from 'react-select';
import './../styles.css';

const SearchResults = lazy(() => import('../components/SearchResults'));

export default function MainSearch() {
  const [city, setCity] = useState('');
  const [masters, setMasters] = useState([]);
  const [selectedProfession, setSelectedProfession] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

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
        .then(setMasters)
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

  const availableMasters = getAvailableMastersForCity(masters, city);
  const availableLocations = getAvailableLocations(masters);
  const availableProfessions = getAvailableProffessions(
    availableMasters,
    professions
  );

  return (
    <>
      <div className="headline-container">
        <h2>
          Я мешкаю в <SearchLocation />, мені потрібен <SearchProffession />
          <br />
        </h2>
      </div>

      {isLoading ? (
        <h2>Loading...</h2>
      ) : isError ? (
        <h2>Error!</h2>
      ) : (
        <SearchResults
          masters={masters}
          city={city}
          profession={selectedProfession}
        />
      )}
    </>
  );

  function SearchLocation() {
    return (
      <Select
        defaultValue={
          city ? availableLocations.find((l) => l.value === city) : city
        }
        placeholder="Оберіть місто"
        options={availableLocations}
        onChange={(e) => {
          setCity(e.value);
        }}
        className="select-container"
      />
    );
  }

  function SearchProffession() {
    return (
      <Select
        defaultValue={
          selectedProfession
            ? availableProfessions.find((p) => p.value === selectedProfession)
            : selectedProfession
        }
        options={availableProfessions}
        placeholder="Оберіть майстра"
        onChange={(e) => setSelectedProfession(e.value)}
        className="select-container"
      />
    );
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
