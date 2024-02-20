import { useContext } from 'react';
import { MasterContext } from '../context';
import MasterCard from './MasterCard';

export default function SearchResults({
  masters,
  city,
  professionCategory,
  showModal,
  setShowModal,
}) {
  const {
    state: { professions },
  } = useContext(MasterContext);

  const availableProfessionIDs = professions
    .filter((p) =>
      !professionCategory ? true : p.categoryID === professionCategory
    )
    .map((p) => p.id);

  const filteredMasters = masters.filter(
    (master) =>
      master.locationID.includes(city) &&
      availableProfessionIDs.includes(master.professionID)
  );

  return (
    <>
      <div className="search-results-header">
        <h2>Знайдено майстрів:</h2>
        <span className="found-amount">{filteredMasters.length}</span>
      </div>
      {filteredMasters.map((master) => (
        <MasterCard
          key={master._id}
          master={master}
          showModal={showModal}
          setShowModal={setShowModal}
        />
      ))}
    </>
  );
}
