import { useContext, useEffect, useRef, useState } from 'react';
import { MasterContext } from '../context';
import { ACTIONS } from '../reducer';
import locations from '../data/locations.json';
import professions from '../data/professions.json';
import SearchResults from '../components/SearchResults';
import { Link } from 'react-router-dom';

export default function MainSearch() {
  const [city, setCity] = useState('turin');
  const [profession, setProffession] = useState('');

  const { state, dispatch } = useContext(MasterContext);
  const { masters } = state;

  const availableMasters = masters.filter((piglet) => {
    return piglet.locationID === city;
  });

  const availableProfessions = [
    ...new Set(availableMasters.map((piglet) => piglet.professionID)),
  ];

  return (
    <>
      <a href="http://t.me/chupakabra_dev_bot">Login</a>
      {/* <Link to={'/add'}>Додати запис</Link> */}
      <h2>
        Я мешкаю в <SearchLocation />, мені потрібен <SearchProffession />
        <button
          type="submit"
          onClick={() => dispatch({ type: ACTIONS.FILTER, payload: {} })}
        >
          Знайти
        </button>
        <br />
      </h2>
      <SearchResults city={city} profession={profession} />
    </>
  );

  function SearchLocation() {
    const options = locations.map((location) => (
      <option key={location.id} value={location.id}>
        {location.city.ua}
      </option>
    ));
    return (
      <select
        name="search-locations"
        defaultValue={city}
        onChange={(e) => setCity(e.target.value)}
      >
        {options}
      </select>
    );
  }

  function SearchProffession() {
    return (
      <select
        name="search-profession"
        onChange={(e) => setProffession(e.target.value)}
        defaultValue=""
      >
        <option value="" disabled>
          Оберіть майстра
        </option>
        {availableProfessions.map((availableProfession) => (
          <option key={availableProfession} value={availableProfession}>
            {professions.find((p) => p.id === availableProfession).name.ua}
          </option>
        ))}
      </select>
    );
  }
}
