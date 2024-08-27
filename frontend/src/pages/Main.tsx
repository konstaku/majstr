import "./../styles.css";

import { useContext, useEffect, useState } from "react";
import Select, {
  CSSObjectWithLabel,
  GroupBase,
  OptionProps,
} from "react-select";
import { MasterContext } from "../context";
import { ACTIONS } from "../data/actions";
import { useNavigation } from "react-router-dom";

import SearchResults from "../components/SearchResults";
import Modal from "../components/Modal";
import {
  trackClickOutsideCard,
  trackEscWhenModalShown,
} from "../helpers/modal";

import type { Profession } from "../schema/state/state.schema";
import type { Master } from "../schema/master/master.schema";

// Setting styles for select elements
export const baseSelectStyles = {
  singleValue: (base: CSSObjectWithLabel) => ({ ...base, color: "white" }),
  menu: (base: CSSObjectWithLabel) => ({
    ...base,
    backgroundColor: "#171923",
    borderRadius: "1rem",
    overflow: "hidden",
  }),
  valueContainer: (base: CSSObjectWithLabel) => ({
    ...base,
    background: "#171923",
    color: "white",
    width: "100%",
    margin: "1rem",
    maxWidth: "300px",
  }),
  option: (
    base: CSSObjectWithLabel,
    state: OptionProps<
      { value: string; label: string },
      boolean,
      GroupBase<{ value: string; label: string }>
    >
  ) => ({
    ...base,
    padding: "1rem",
    cursor: "pointer",
    paddingTop: "0.5rem",
    paddingBottom: "0.5rem",
    borderRadius: "10px",
    backgroundColor: state.isFocused ? "#4fd1c5" : "#171923",
  }),
  control: (base: CSSObjectWithLabel) => ({
    ...base,
    cursor: "pointer",
  }),
};

// eslint-disable-next-line react-refresh/only-export-components
function Main() {
  const { state, dispatch } = useContext(MasterContext);
  const {
    masters,
    professions,
    locations,
    countries,
    countryID,
    profCategories,
    searchParams,
    error,
  } = state;
  const { selectedCity, selectedProfessionCategory } = searchParams;
  const [showModal, setShowModal] = useState<string | null | boolean>(null);
  const { state: loadingState } = useNavigation();
  const isLoading = loadingState === "loading";
  const isError = false; // Need to add state

  const currentCountry = countries.find((country) => country.id === countryID);

  if (error) {
    throw new Error(error);
  }

  // Check for an open mastercard in search params on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modalCard = params.get("card" || null);
    if (!modalCard) return;

    const masterIsValid = masters.find((master) => master._id === modalCard);
    if (modalCard && masterIsValid) {
      setShowModal(modalCard);
    }
  }, [masters]);

  // Display master name in page title whenever modal pops
  // Track document clicks outside modal
  useEffect(() => {
    const clickListener = (e: MouseEvent) =>
      trackClickOutsideCard(e, "details-modal", setShowModal);
    const keyUpListener = (e: KeyboardEvent) =>
      trackEscWhenModalShown(e, setShowModal);

    if (showModal) {
      const currentMaster = masters.find((master) => master._id === showModal);
      if (!currentMaster) return;

      document.addEventListener("click", clickListener);
      document.addEventListener("keyup", keyUpListener);

      const professionName = professions.find(
        (profession) => profession.id === currentMaster.professionID
      )?.name.ua;
      const cityName = locations.find(
        (location) => location.id === currentMaster.locationID
      )?.name.ua_alt;

      document.title = `${currentMaster.name} | ${professionName} в ${cityName}`;
    }

    return () => {
      if (showModal) {
        document.removeEventListener("click", clickListener);
        document.removeEventListener("keyup", keyUpListener);
      }
      document.title = "Majstr : Знаходь українських майстрів";
    };
  }, [showModal, masters, locations, professions]);

  // The first value is always an empty string, so the user can always return to "all" as an option
  // Then, I always display every location with at least one master in it
  const locationPlaceholder = currentCountry
    ? {
        value: "",
        label: `Вся ${currentCountry?.name.ua}`,
      }
    : { value: "", label: "🤔 🤔 🤔" };

  const availableLocations = [locationPlaceholder].concat(
    // Array of unique locations only
    [
      ...new Set(
        masters
          .filter((master) => master.countryID === countryID)
          .map((master) => master.locationID)
      ),
    ].map((masterLocationId) => ({
      value: masterLocationId,
      label:
        locations.find((location) => location.id === masterLocationId)?.name
          .ua_alt || "",
    }))
  );

  // Here I filter out unique proffessions for the selected city
  const availableProfessionIDs =
    // Array of unique proffessions
    [
      ...new Set(
        masters
          .filter((master) => {
            if (selectedCity) {
              // If a city is selected, display unique proffessions for that city
              return master.locationID === selectedCity;
            }
            // Otherwise display unique proffessions from all cities
            return true;
          })
          .map((master) => master.professionID)
      ),
    ];

  function generateProfessionsSelectOptions(professionIDlist: string[]) {
    const result = [
      {
        // The first element is "Everyone", which is an empty string
        value: "",
        label: "Всі майстри",
      },
    ];

    const uniqueProfessionCategories = [
      ...new Set(
        professionIDlist.map((p) => getProfessionCategoryById(professions, p))
      ),
    ];

    const professionLabelList = uniqueProfessionCategories.map(
      (professionCategoryID) => {
        let label = profCategories.find(
          (profCategory) => profCategory.id === professionCategoryID
        )?.name.ua;
        if (!label) label = "";

        return {
          value: professionCategoryID,
          label: label,
        };
      }
    );

    result.push(...professionLabelList);

    return result;
  }

  const professionSelectOptions = generateProfessionsSelectOptions(
    availableProfessionIDs
  );

  return (
    <>
      <div className="search-field">
        <span className="search-left">
          Я мешкаю в
          <SearchLocation />
        </span>
        <span className="search-right">
          та шукаю <SearchProffession />
        </span>
      </div>

      <div className="search-results-container">
        {isLoading ? (
          <div className="search-results-header">
            <h2>Шукаємо...</h2>
          </div>
        ) : isError ? (
          <div className="search-results-header">
            <h2>Неможливо виконати запит</h2>
          </div>
        ) : (
          <>
            <SearchResults
              masters={masters}
              city={selectedCity}
              professionCategory={selectedProfessionCategory}
              setShowModal={setShowModal}
            />
            {/* The modal is shown conditionally, when there is someone to show */}
            {showModal && isModalMaster(showModal) && (
              <Modal
                // id={showModal}
                master={isModalMaster(showModal) as Master}
                setShowModal={setShowModal}
              ></Modal>
            )}
          </>
        )}
      </div>
    </>
  );

  function SearchLocation() {
    return (
      <Select
        className="headline-select"
        unstyled
        isSearchable={false}
        defaultValue={
          selectedCity
            ? availableLocations.find((l) => l.value === selectedCity)
            : availableLocations[0]
        }
        options={availableLocations}
        styles={{
          ...baseSelectStyles,
          valueContainer: (base) => ({
            ...base,
            minWidth: "150px",
          }),
        }}
        onChange={(e) => {
          if (e && "value" in e) {
            dispatch({
              type: ACTIONS.SET_CITY,
              payload: { selectedCity: e.value },
            });
          }
        }}
      />
    );
  }

  function SearchProffession() {
    const foundSelectedProfession = professionSelectOptions.find(
      (p) => p.value === selectedProfessionCategory
    );

    const defaultProfessionValue = foundSelectedProfession
      ? foundSelectedProfession
      : {
          // The first element is "Everyone", which is an empty string
          value: "",
          label: "Всі майстри",
        };
    console.log("defaultProfessionValue:", defaultProfessionValue);
    console.log("selectedProfessionCategory:", selectedProfessionCategory);

    return (
      <Select
        className="headline-select"
        defaultValue={{
          value: selectedProfessionCategory,
          label: defaultProfessionValue.label,
        }}
        unstyled
        isSearchable={false}
        // options={availableProfessions}
        options={professionSelectOptions}
        styles={baseSelectStyles}
        placeholder="Всі майстри"
        onChange={(e) => {
          if (e && "value" in e) {
            dispatch({
              type: ACTIONS.SET_PROFESSION,
              payload: { selectedProfessionCategory: e.value },
            });
          }
        }}
      />
    );
  }

  function isModalMaster(id: string | boolean) {
    if (!(typeof id === "string")) return false;
    return masters.find((master) => master._id === id) || null;
  }
}

function getProfessionCategoryById(
  professions: Profession[],
  professionID: string
) {
  const result = professions.find((p) => p.id === professionID)?.categoryID;
  if (typeof result !== "string") {
    throw new Error(`Can not find profession category for id ${professionID}`);
  }
  return result;
}

export const mainRoute = {
  // loader,
  element: <Main />,
};
