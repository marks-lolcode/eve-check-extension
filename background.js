chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const systems = document.querySelectorAll('.pf-system');
      console.log(`Found ${systems.length} systems.`);

      for (let system of systems) {
        const nameEl = system.querySelector('.pf-system-head-name');
        const tagEl = system.querySelector('.pf-system-head-tag');
        const secEl = system.querySelector('.pf-system-sec');

        let rawName = nameEl?.dataset?.value || nameEl?.textContent?.trim();
        let name = rawName?.split(/\s+/)[0];
        const tag = tagEl?.dataset?.value || tagEl?.textContent?.trim();
        const sec = secEl?.dataset?.value || secEl?.textContent?.trim();

        if (name && tag === "Static" && sec === "HS") {
          chrome.runtime.sendMessage({ systemName: name });
          break;
        }
      }
    }
  });
});

// Receive the message from content script and open the tab
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.systemName) {
    const url = `https://eve-gatecheck.space/eve/#${message.systemName}:Jita:shortest`;
    chrome.tabs.create({ url });
  }
});
