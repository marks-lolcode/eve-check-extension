document.getElementById('runCheck').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        console.log("🔍 Running system scan...");

        const systems = document.querySelectorAll('.pf-system');
        console.log(`Found ${systems.length} systems.`);

        for (let system of systems) {
          const nameEl = system.querySelector('.pf-system-head-name');
          const tagEl = system.querySelector('.pf-system-head-tag');
          const secEl = system.querySelector('.pf-system-sec');

          let rawName = nameEl?.dataset?.value || nameEl?.textContent?.trim();
          let name = rawName?.split(/\s+/)[0]; // <-- get only first word
          const tag = tagEl?.dataset?.value || tagEl?.textContent?.trim();
          const sec = secEl?.dataset?.value || secEl?.textContent?.trim();

          console.log(`System Check → Name: ${name}, Tag: ${tag}, Sec: ${sec}`);

          if (name && tag === "Static" && sec === "HS") {
            const newUrl = `https://eve-gatecheck.space/eve/#${name}:Jita:shortest`;
            console.log(`✅ Match found! Opening: ${newUrl}`);
            window.open(newUrl, '_blank');
            break;
          }
        }

        console.log("✅ Script finished.");
      }
    });
  });
});
