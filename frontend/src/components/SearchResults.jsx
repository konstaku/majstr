import MasterCard from './MasterCard';

export default function SearchResults({
  masters,
  city,
  profession,
  showModal,
  setShowModal,
}) {
  const filteredMasters = masters.filter(
    (master) =>
      master.locationID.includes(city) &&
      master.professionID.includes(profession)
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
