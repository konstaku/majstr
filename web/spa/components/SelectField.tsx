"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
  count: number | "SOON";
}

interface Props {
  kicker: string;
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
}

export function SelectField({ kicker, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const fieldRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  const openMenu = () => {
    if (!fieldRef.current) return;
    const sf = fieldRef.current.getBoundingClientRect();
    const parent = fieldRef.current.parentElement;      // filter-toggle-wrap
    const grandparent = parent?.parentElement;           // hero-filter-row

    // The visual "select" extends into the border of the surrounding containers.
    // hero-filter-row has a 2px border on all sides; filter-toggle-wrap has a
    // 2px right border on desktop (the divider between city and trade).
    // On mobile, hero-filter-row becomes flex-column so we extend to its right
    // border instead of the parent's right divider.
    const gpBorderLeft  = grandparent ? parseFloat(getComputedStyle(grandparent).borderLeftWidth)  || 0 : 0;
    const gpBorderRight = grandparent ? parseFloat(getComputedStyle(grandparent).borderRightWidth) || 0 : 0;
    const parentBorderRight = parent  ? parseFloat(getComputedStyle(parent).borderRightWidth)      || 0 : 0;

    const isColumn = grandparent
      ? getComputedStyle(grandparent).flexDirection === "column"
      : false;

    const extraLeft  = gpBorderLeft;
    const extraRight = isColumn ? gpBorderRight : parentBorderRight;

    setMenuStyle({
      position: "fixed",
      top: sf.bottom,
      left: sf.left - extraLeft,
      width: sf.width + extraLeft + extraRight,
      zIndex: 9999,
    });
    setOpen(true);
  };

  const closeMenu = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!fieldRef.current?.contains(e.target as Node)) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={fieldRef}
      className={`sf-field${open ? " sf-open" : ""}`}
      onClick={() => (open ? closeMenu() : openMenu())}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") open ? closeMenu() : openMenu();
      }}
      aria-haspopup="listbox"
      aria-expanded={open}
    >
      <span className="sf-kicker">{kicker}</span>
      <span className="sf-value">{selected?.label ?? ""}</span>
      <span className="sf-chev" aria-hidden="true">▾</span>

      {open && typeof document !== "undefined" && createPortal(
        <div className="sf-menu" style={menuStyle} role="listbox">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`sf-opt${opt.value === value ? " sf-sel" : ""}`}
              role="option"
              aria-selected={opt.value === value}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.value);
                closeMenu();
              }}
            >
              <span className="sf-mk" aria-hidden="true" />
              <span className="sf-opt-label">{opt.label}</span>
              <span className={`sf-opt-meta${opt.count === "SOON" ? " sf-soon" : ""}`}>
                {opt.count}
              </span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
