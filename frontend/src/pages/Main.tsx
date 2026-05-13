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
import { useTranslation } from "../custom-hooks/useTranslation";

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
  const { t, lang } = useTranslation();

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

      const profEntry = professions.find(
        (profession) => profession.id === currentMaster.professionID
      );
      const professionName = lang === "uk" ? profEntry?.name.ua : profEntry?.name.en;
      const cityData = locations.find(
        (location) => location.id === currentMaster.locationID
      );
      const cityName = lang === "uk" ? cityData?.name.ua_alt : cityData?.name.en;

      document.title = `${currentMaster.name} | ${professionName} ${t("main.inCity")} ${cityName}`;
    }

    return () => {
      if (showModal) {
        document.removeEventListener("click", clickListener);
        document.removeEventListener("keyup", keyUpListener);
      }
      document.title = t("main.appTitle");
    };
  }, [showModal, masters, locations, professions]);

  // The first value is always an empty string, so the user can always return to "all" as an option
  // Then, I always display every location with at least one master in it
  const countryDisplayName = currentCountry
    ? lang === "uk"
      ? currentCountry.name.ua
      : currentCountry.name.en
    : "";
  const locationPlaceholder = currentCountry
    ? { value: "", label: t("main.allCountry", { country: countryDisplayName }) }
    : { value: "", label: "🤔 🤔 🤔" };

  const availableLocations = [locationPlaceholder].concat(
    // Array of unique locations only
    [
      ...new Set(
        masters
          .filter((master) => master.countryID === countryID)
          .map((master) => master.locationID)
      ),
    ].map((masterLocationId) => {
      const loc = locations.find((l) => l.id === masterLocationId);
      return {
        value: masterLocationId,
        label: lang === "uk" ? loc?.name.ua_alt ?? "" : loc?.name.en ?? "",
      };
    })
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
        value: "",
        label: t("main.allMasters"),
      },
    ];

    const uniqueProfessionCategories = [
      ...new Set(
        professionIDlist.map((p) => getProfessionCategoryById(professions, p))
      ),
    ];

    const professionLabelList = uniqueProfessionCategories.map(
      (professionCategoryID) => {
        const cat = profCategories.find((c) => c.id === professionCategoryID);
        const label = lang === "uk" ? cat?.name.ua ?? "" : cat?.name.en ?? "";
        return { value: professionCategoryID, label };
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
          {t("main.liveIn")}
          <SearchLocation />
        </span>
        <span className="search-right">
          {t("main.lookingFor")} <SearchProffession />
        </span>
      </div>

      <div className="search-results-container">
        {isLoading ? (
          <div className="search-results-header">
            <h2>{t("main.searching")}</h2>
          </div>
        ) : isError ? (
          <div className="search-results-header">
            <h2>{t("main.cannotSearch")}</h2>
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
      : { value: "", label: t("main.allMasters") };
    return (
      <Select
        className="headline-select"
        defaultValue={{
          value: selectedProfessionCategory,
          label: defaultProfessionValue.label,
        }}
        unstyled
        isSearchable={false}
        options={professionSelectOptions}
        styles={baseSelectStyles}
        placeholder={t("main.allMasters")}
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
