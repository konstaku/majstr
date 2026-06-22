"use client";

import { useEffect, useState } from "react";
import NewMasterPreview from "../components/NewMasterPreview";
import { apiFetch } from "../api/client";
import type { Master } from "../schema/master/master.schema";
import type { Profession } from "../schema/state/state.schema";

// Pending-master moderation list. The React Router loader fetched /?q=newmasters
// server-side and professions came from the catalogue loader; under Next this is
// a standalone client route, so it fetches both itself on mount (the (app)
// MasterContext is mounted without the catalogue seed).
export default function Admin() {
  const [newMasters, setNewMasters] = useState<Master[]>([]);
  const [professions, setProfessions] = useState<Profession[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    const asArray = <T,>(r: Response): Promise<T[]> =>
      r.ok ? r.json() : Promise.resolve([]);

    Promise.all([
      apiFetch("/?q=newmasters", opts).then((r) => asArray<Master>(r)),
      apiFetch("/?q=professions", opts).then((r) => asArray<Profession>(r)),
    ])
      .then(([masters, profs]) => {
        setNewMasters(Array.isArray(masters) ? masters : []);
        setProfessions(Array.isArray(profs) ? profs : []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <div className="search-results-container">
      <div className="search-results-header">
        <h2>Нових майстрів:</h2>
        <span className="found-amount">{newMasters.length}</span>
      </div>
      {newMasters.map((master, i) => (
        <NewMasterPreview key={i} master={master} professions={professions} />
      ))}
    </div>
  );
}
