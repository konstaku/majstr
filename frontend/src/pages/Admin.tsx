import { useContext } from "react";
import { useLoaderData } from "react-router-dom";
import { MasterContext } from "../context";
import NewMasterPreview from "../components/NewMasterPreview";
import { apiFetch } from "../api/client";

import type { Master } from "../schema/master/master.schema";

// eslint-disable-next-line react-refresh/only-export-components
function Admin() {
  const newMasters = useLoaderData() as Master[];
  const {
    state: { professions },
  } = useContext(MasterContext);

  return (
    <div className="search-results-container">
      <div className="search-results-header">
        <h2>Нових майстрів:</h2>
        <span className="found-amount">{newMasters.length}</span>
      </div>
      {newMasters.map((master, i) => (
        <NewMasterPreview
          key={i}
          master={master}
          professions={professions}
        />
      ))}
    </div>
  );
}

function loader({ request }: { request: Request }) {
  return apiFetch("/?q=newmasters", { signal: request.signal });
}

export const adminRoute = {
  element: <Admin />,
  loader,
};
