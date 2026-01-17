const statusEl = document.querySelector<HTMLParagraphElement>("#status");

const setStatus = (message: string) => {
  if (statusEl) {
    statusEl.textContent = message;
  }
};

if (window.tanda) {
  window.tanda
    .ping()
    .then((message) => setStatus(`Main process says: ${message}`))
    .catch(() => setStatus("Main process unavailable"));
} else {
  setStatus("API bridge not available");
}
