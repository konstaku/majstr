import React, { useEffect, useState } from 'react';
import locations from '../data/locations.json';
import professions from '../data/professions.json';
//import SearchResults from '../components/SearchResults';
import Select from 'react-select';

const SearchResults = React.lazy(() => import('../components/SearchResults'));

export default function MainSearch() {
  const [masters, setMasters] = useState([]);
  const [city, setCity] = useState('');
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

  const availableMasters = masters.filter((master) => {
    return master.locationID.includes(city);
  });

  const availableLocations = [
    ...new Set(masters.map((master) => master.locationID)),
  ].map((location) => ({
    value: location,
    label: locations.find((l) => l.id === location).city.ua_alt,
  }));

  const availableProfessions = [
    ...new Set(availableMasters.map((master) => master.professionID)),
  ].map((professionID) => ({
    value: professionID,
    label: professions.find((p) => p.id === professionID).name.ua,
  }));

  return (
    <>
      <a href="https://t.me/chupakabra_dev_bot">Login</a>
      {/* <Link to={'/add'}>Додати запис</Link> */}
      <h2>
        Я мешкаю в <SearchLocation />, мені потрібен <SearchProffession />
        <br />
      </h2>
      {isLoading ? (
        <h2>Loading...</h2>
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
        placeholder="Оберіть"
        onChange={(e) => setSelectedProfession(e.value)}
      />
    );
  }
}
