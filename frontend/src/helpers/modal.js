export function trackClickOutsideCard(event, id, setFunction) {
  const modalCard = document.getElementById(id);
  const target = event.target;

  if (target.contains(modalCard)) {
    setFunction(null);
  }
}

export function trackEscWhenModalShown(event, setFunction) {
  if (event.key === 'Escape') {
    setFunction(null);
  }
}
