// Scan the page for systems with Static tag and HS sec
function findSystemAndSend() {
  const systems = document.querySelectorAll('.pf-system');

  for (let system of systems) {
    const nameEl = system.querySelector('.pf-system-head-name');
    const tagEl = system.querySelector('.pf-system-head-tag');
    const secEl = system.querySelector('.pf-system-sec');

    if (
      nameEl?.dataset?.value &&
      tagEl?.dataset?.value === "Static" &&
      secEl?.dataset?.value === "HS"
    ) {
      const systemName = nameEl.dataset.value;
      chrome.runtime.sendMessage({ systemName });
      break; // Only need the first match
    }
  }
}

// Run after page loads
window.addEventListener('load', findSystemAndSend);
