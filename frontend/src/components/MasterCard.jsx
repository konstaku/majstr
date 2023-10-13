import professions from './../data/professions.json';
import locations from './../data/locations.json';

export default function MasterCard({ master }) {
  const { id, name, professionID, locationID, contacts, about } = master;

  return (
    <div style={{ minWidth: '250px' }}>
      {/* <div
        style={{
          width: '75px',
          height: '75px',
          borderRadius: '10000px',
          backgroundImage: `url("/src/data/userpics/${id}.jpeg")`,
          backgroundSize: 'cover',
        }}
      ></div> */}
      <h3>{name}</h3>
      <h4>
        {professions.find((p) => p.id === professionID).name.ua},{' '}
        {locations.find((l) => l.id === locationID).city.ua}
      </h4>
      <h5>
        Contacts:{' '}
        {contacts.map((contact) => (
          <div
            key={Math.random().toString()}
          >{`${contact.type}: ${contact.value}`}</div>
        ))}
      </h5>
      <p>{about}</p>
    </div>
  );
}
