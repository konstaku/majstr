import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor, within, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import { renderRoute, ROUTE_ERROR_TEXT } from "../test/renderRoute";

// These mount real app routes through the production provider stack + route
// tree (see renderRoute). They guard the class of bug that shipped on
// 2026-06-15: a standalone route rendering a context-dependent child (the
// PickerSheet → useOnbT) without the required provider, which crashed into the
// router errorElement the moment a picker opened.

const API = "http://localhost:5001";

const profCategories = [
  { _id: "c1", id: "construction", name: { ua: "Будівництво", en: "Construction" } },
];
const professions = [
  { _id: "p1", id: "plumber", categoryID: "construction", name: { ua: "Сантехнік", en: "Plumber" } },
  { _id: "p2", id: "electrician", categoryID: "construction", name: { ua: "Електрик", en: "Electrician" } },
];
const locations = [
  { _id: "l1", id: "milan", countryID: "IT", name: { ua: "Мілан", en: "Milan" } },
];

// A claimed card the owner manages — profession is set, so its category is
// derivable and the profession picker is ENABLED (the exact repro path).
const ownedMaster = {
  _id: "684700000000000000000abc",
  name: "Іван Сантехнік",
  status: "approved",
  professionID: "plumber",
  locationID: "milan",
  about: "Лагоджу труби",
  contacts: [{ contactType: "phone", value: "+39 333 1234567" }],
  photo: null,
  tags: { ua: [], en: [] },
  languages: ["uk"],
  availability: "available",
};

function mockReferenceData() {
  server.use(
    http.get(`${API}/api/reference/professions`, () => HttpResponse.json(professions)),
    http.get(`${API}/api/reference/prof-categories`, () => HttpResponse.json(profCategories)),
    http.get(`${API}/api/reference/locations`, () => HttpResponse.json(locations))
  );
}

describe("/my-cards", () => {
  beforeEach(() => {
    mockReferenceData();
    server.use(
      http.get(`${API}/api/masters/mine`, () => HttpResponse.json({ masters: [ownedMaster] }))
    );
  });

  it("renders the owner action menu with Edit primary and Hide/Delete compact", async () => {
    renderRoute("/my-cards");

    const edit = await screen.findByRole("button", { name: "Редагувати" });
    // Bug #1 guard: Edit is the prominent action, Hide/Delete are compact so
    // Delete can't be fat-fingered.
    expect(edit.className).toContain("wizard-ghost-btn--primary");
    expect(screen.getByRole("button", { name: "Приховати" }).className).toContain("wizard-ghost-btn--compact");
    expect(screen.getByRole("button", { name: "Видалити" }).className).toContain("wizard-ghost-btn--compact");
  });

  it("opens the profession picker without crashing into the error page", async () => {
    renderRoute("/my-cards");

    fireEvent.click(await screen.findByRole("button", { name: "Редагувати" }));

    // Profession button shows the selected profession; clicking it mounts the
    // PickerSheet, which calls useOnbT(). Before the provider fix this threw.
    fireEvent.click(await screen.findByRole("button", { name: /Сантехнік/ }));

    await waitFor(() =>
      expect(document.querySelector(".picker-sheet")).toBeInTheDocument()
    );
    expect(screen.queryByText(ROUTE_ERROR_TEXT)).not.toBeInTheDocument();

    // And it's actually usable — the other profession in the category is listed.
    const sheet = document.querySelector(".picker-sheet") as HTMLElement;
    expect(within(sheet).getByText("Електрик")).toBeInTheDocument();
  });
});

describe("/onboard", () => {
  beforeEach(mockReferenceData);

  it("mounts the wizard without hitting the error page", async () => {
    renderRoute("/onboard");
    // Step counter is part of the wizard chrome; its presence proves the
    // provider tree (i18n + telegram + form) mounted cleanly.
    await waitFor(() =>
      expect(document.querySelector(".wizard-progress")).toBeInTheDocument()
    );
    expect(screen.queryByText(ROUTE_ERROR_TEXT)).not.toBeInTheDocument();
  });
});

describe("/claim/:masterId", () => {
  it("mounts and shows the open-in-Telegram guidance on the web surface", async () => {
    renderRoute("/claim/684700000000000000000abc");
    // Outside Telegram the claim can't be verified; the screen must render its
    // own guidance, not throw.
    expect(
      await screen.findByText(/Відкрийте це посилання через Telegram/)
    ).toBeInTheDocument();
    expect(screen.queryByText(ROUTE_ERROR_TEXT)).not.toBeInTheDocument();
  });
});
