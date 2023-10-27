import { lazy, useEffect, useState } from 'react';
import locations from '../data/locations.json';
import professions from '../data/professions.json';
import Select from 'react-select';
import './../styles.css';

const SearchResults = lazy(() => import('../components/SearchResults'));

export default function MainSearch() {
  const [cardIsFlipped, setCardIsFlipped] = useState({ id: null });
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
      <header>
        <div className="header">
          <div className="logo">
            <img src="/img/logo/logo-dark.svg" alt="logo" width="150px" />
          </div>
          <div className="menu">
            <ul>
              <li>Пошук</li>
              <li className="inactive">Особистий кабінет</li>
              <li className="inactive">FAQ</li>
            </ul>
          </div>
          <div className="select-country">
            <span>🇮🇹</span>
            <span>Італія</span>
          </div>
        </div>
        <div className="search-field">
          <span className="search-left">
            Я мешкаю в
            <SearchLocation />
          </span>
          <span className="search-right">
            та шукаю <SearchProffession />
          </span>
        </div>
      </header>

      {isLoading ? (
        <div className="search-results-container">
          <div className="search-results-header">
            <h2>Шукаємо...</h2>
          </div>
        </div>
      ) : isError ? (
        <div className="search-results-container">
          <div className="search-results-header">
            <h2>Неможливо виконати запит</h2>
          </div>
        </div>
      ) : (
        <SearchResults
          masters={masters}
          city={city}
          profession={selectedProfession}
          cardIsFlipped={cardIsFlipped}
          setCardIsFlipped={setCardIsFlipped}
        />
      )}

      <div className="footer">
        <div className="terms">
          <ul>
            <li>Умови використання</li>
            <li>Питання та відповіді</li>
            <li>Політика модерації</li>
            <li>Зворотній звʼязок</li>
          </ul>
        </div>
        <div className="love">
          <span>❤️</span>
          <span>🇺🇦</span>
        </div>
      </div>
    </>
  );

  function SearchLocation() {
    return (
      <Select
        className="headline-select"
        unstyled
        defaultValue={
          city ? availableLocations.find((l) => l.value === city) : city
        }
        placeholder="Вся Італія"
        options={availableLocations}
        styles={headlineSelectStyles}
        onChange={(e) => {
          setCity(e.value);
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
        onChange={(e) => setSelectedProfession(e.value)}
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
