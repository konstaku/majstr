import { useEffect, useRef, useState } from "react";
import { useHaptic } from "../../ui/useHaptic";
import { useOnbT } from "../i18n";

export interface PickerOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface PickerSheetProps {
  title: string;
  options: PickerOption[];
  selected?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  searchPlaceholder?: string;
}

export function PickerSheet({
  title,
  options,
  selected,
  onSelect,
  onClose,
  searchPlaceholder,
}: PickerSheetProps) {
  const { t } = useOnbT();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const haptic = useHaptic();

  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = query.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.sublabel?.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  const handleSelect = (value: string) => {
    haptic.selection();
    onSelect(value);
    onClose();
  };

  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <span className="picker-title">{title}</span>
          <button className="picker-close" onClick={onClose} aria-label={t("picker.close")}>✕</button>
        </div>
        <div className="picker-search-wrap">
          <input
            ref={searchRef}
            className="picker-search"
            placeholder={searchPlaceholder ?? t("picker.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="picker-list">
          {filtered.length === 0 && (
            <div className="picker-empty">{t("picker.empty")}</div>
          )}
          {filtered.map((opt) => (
            <button
              key={opt.value}
              className={`picker-item${opt.value === selected ? " picker-item--selected" : ""}`}
              onClick={() => handleSelect(opt.value)}
            >
              <span className="picker-item-label">{opt.label}</span>
              {opt.sublabel && (
                <span className="picker-item-sublabel">{opt.sublabel}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
