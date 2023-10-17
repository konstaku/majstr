import { useContext } from 'react';
import { MasterContext } from '../context';
import MasterCard from './MasterCard';

export default function SearchResults({ masters, city, profession }) {
  const filteredMasters = masters.filter(
    (master) =>
      master.locationID === city && master.professionID.includes(profession)
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '2rem',
      }}
    >
      {filteredMasters.map((master) => (
        <MasterCard key={master.id} master={master} />
      ))}
    </div>
  );
}
