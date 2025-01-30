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
  const isAsbSubtitlesAdded = ["miruro.tv/watch", "*hianime.to/watch*", "youtube.com/watch", "animesugetv.to/watch"];
  const DEBOUNCE_DELAY = 250; // Delay for debouncing parse requests

  // Function to check if the current site is in the specific list
  const isSpecificSite = () =>
    SPECIFIC_SITES.some((site) => window.location.href.includes(site));

  // Function to check if current site needs subtitle parsing
  const isSubtitleSite = () =>
    isAsbSubtitlesAdded.some(site => window.location.href.includes(site));

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

  // Parse specific element
  const parseElement = async (element) => {
    try {
      const paragraphs = paragraphsInNode(element);
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

  // --- Subtitle Observer Setup ---
  const setupSubtitleObserver = () => {
    // Keep track of observed elements to avoid duplicate observers
    const observedElements = new Set();
    
    // Create a mutation observer that will never disconnect
    const perpetualObserver = new MutationObserver((mutations) => {
      // Look for subtitle elements that we haven't observed yet
      document.querySelectorAll('.asbplayer-subtitles').forEach(subtitlesElement => {
        if (!observedElements.has(subtitlesElement)) {
          observedElements.add(subtitlesElement);
          
          // Create observer for this specific subtitle element
          const textObserver = new MutationObserver(() => {
            parseElement(subtitlesElement);
          });

          // Observe text changes
          textObserver.observe(subtitlesElement, {
            characterData: true,
            childList: true,
            subtree: true
          });

          // Initial parse
          parseElement(subtitlesElement);
        }
      });
    });

    // Start observing the entire document and never stop
    perpetualObserver.observe(document, {
      childList: true,
      subtree: true
    });
  };

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
  // Setup subtitle observer if needed
  if (isSubtitleSite()) {
    setupSubtitleObserver();
  }

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