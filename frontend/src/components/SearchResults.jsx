import MasterCard from './MasterCard';
import { ConfigProvider } from 'antd';

const searchConfigTheme = {
  components: {
    Collapse: {
      contentPadding: '0px',
      padding: '0px',
    },
  },
};

export default function SearchResults({ masters, city, profession }) {
  const filteredMasters = masters.filter(
    (master) =>
      master.locationID.includes(city) &&
      master.professionID.includes(profession)
  );

  return (
    <ConfigProvider theme={searchConfigTheme}>
      <div className="search-results-container">
        {filteredMasters.map((master) => (
          <MasterCard key={master._id} master={master} />
        ))}
      </div>
    </ConfigProvider>
  );
}
