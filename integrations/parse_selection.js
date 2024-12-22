(async () => {
  "use strict";

  const $browser = globalThis.browser ?? globalThis.chrome;
  const $import = (path) => import($browser.runtime.getURL(path));
  const { browser } = await $import("/util.js");
  const { paragraphsInNode, parseParagraphs } = await $import(
    "/integrations/common.js"
  );
  const { requestParse } = await $import("/content/background_comms.js");
  const { showError } = await $import("/content/toast.js");

  // --- Constants and Helpers ---
  const SPECIFIC_SITES = ["ankiuser.net", "ankiweb.net", "jpdb.io"];
  const DEBOUNCE_DELAY = 250; // Delay for debouncing parse requests

  // Function to check if the current site is in the specific list
  const isSpecificSite = () =>
    SPECIFIC_SITES.some((site) => window.location.href.includes(site));

  // Debounce function to limit parse calls
  const debounce = (func, delay) => {
    let debounceTimer;
    return (...args) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => func(...args), delay);
    };
  };

  // --- Parsing Logic ---
  const handleParsing = async () => {
    try {
      const paragraphs = paragraphsInNode(document.body);
      if (paragraphs.length === 0) return;

      const [batches, applied] = parseParagraphs(paragraphs);
      requestParse(batches);
      await Promise.allSettled(applied);
    } catch (error) {
      showError(error);
    }
  };

  // Debounced parsing function
  const debouncedParse = debounce(handleParsing, DEBOUNCE_DELAY);

  // --- Button Setup ---
  const parsePageButton = document.createElement("button");
  parsePageButton.textContent = "Parse selection";
  Object.assign(parsePageButton.style, {
    position: "fixed",
    top: "0",
    right: "0",
    zIndex: "9999",
  });
  document.body.appendChild(parsePageButton);

  parsePageButton.addEventListener("click", () => {
    browser.tabs.executeScript({ file: "/integrations/contextmenu.js" });
  });

  // --- Event Handling ---
  // Initial parse (excluding specific sites)
  if (!isSpecificSite()) {
    debouncedParse();
  } else {
    // Specific site handling: initial parse with delay, and debounced click/touch handling
    setTimeout(debouncedParse, 1000);

    const eventHandler = () => debouncedParse();

    document.body.addEventListener("click", eventHandler, { passive: true });
    document.body.addEventListener("touchstart", eventHandler, {
      passive: true,
    });
  }
})();
