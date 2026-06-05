"use client";

import { useState } from "react";
import MasterCard from "./MasterCard";
import Modal from "./Modal";
import type { Master } from "../schema/master/master.schema";

// The real masters grid + modal for a landing page, reusing the exact
// MasterCard + Modal components. Cards are crawlable links to master pages;
// left-click opens the modal (UX preserved).
export default function LandingResults({ masters }: { masters: Master[] }) {
  const [showModal, setShowModal] = useState<string | null | boolean>(null);
  const current =
    typeof showModal === "string"
      ? masters.find((m) => m._id === showModal) ?? null
      : null;

  return (
    <>
      <div className="masters-grid">
        {masters.map((m) => (
          <MasterCard
            key={m._id}
            master={m}
            setShowModal={setShowModal as (show: string) => void}
          />
        ))}
      </div>
      {current && <Modal master={current} setShowModal={setShowModal} />}
    </>
  );
}
