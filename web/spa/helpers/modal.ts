export function trackClickOutsideCard(
  event: MouseEvent,
  id: string,
  setFunction: (masterId: string | null | boolean) => void
) {
  const modalCard = document.getElementById(id);
  const target = event.target;

  if (modalCard && target instanceof Element && target.contains(modalCard)) {
    setFunction(null);
  }
}

export function trackEscWhenModalShown(
  event: KeyboardEvent,
  setFunction: (masterId: string | null | boolean) => void
) {
  if (event.key === "Escape") {
    setFunction(null);
  }
}
