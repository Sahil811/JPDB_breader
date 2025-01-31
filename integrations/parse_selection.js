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
  const SPECIFIC_SITES = ["ankiuser.net", "ankiweb.net", "jpdb.io", "anime"];
  const isAsbSubtitlesAdded = ["miruro.tv/watch", "*hianime.to/watch*", "youtube.com/watch", "animesugetv.to/watch"];
  const DEBOUNCE_DELAY = 250;
  
  // Subtitle class selectors
  const SUBTITLE_SELECTORS = '.asbplayer-subtitles, .asbplayer-fullscreen-subtitles';

  const isSpecificSite = () =>
    SPECIFIC_SITES.some((site) => window.location.href.includes(site));

  const isSubtitleSite = () =>
    isAsbSubtitlesAdded.some(site => window.location.href.includes(site));

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

  const parseElement = async (element) => {
    try {
      if (!element || !element.textContent.trim()) return;
      
      const paragraphs = paragraphsInNode(element);
      if (paragraphs.length === 0) return;

      const [batches, applied] = parseParagraphs(paragraphs);
      requestParse(batches);
      await Promise.allSettled(applied);
    } catch (error) {
      showError(error);
    }
  };

  const debouncedParse = debounce(handleParsing, DEBOUNCE_DELAY);

  // --- Subtitle Observer Setup ---
  const setupSubtitleObserver = () => {
    const observedElements = new Set();
    
    const perpetualObserver = new MutationObserver((mutations) => {
      // Look for both normal and fullscreen subtitle elements
      document.querySelectorAll(SUBTITLE_SELECTORS).forEach(subtitlesElement => {
        if (!observedElements.has(subtitlesElement)) {
          observedElements.add(subtitlesElement);
          
          const textObserver = new MutationObserver(() => {
            if (subtitlesElement.textContent.trim()) {
              parseElement(subtitlesElement);
            }
          });

          textObserver.observe(subtitlesElement, {
            characterData: true,
            childList: true,
            subtree: true
          });

          if (subtitlesElement.textContent.trim()) {
            parseElement(subtitlesElement);
          }
        }
      });
    });

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
  if (isSubtitleSite()) {
    setupSubtitleObserver();
  }

  if (!isSpecificSite()) {
    debouncedParse();
  } else {
    setTimeout(debouncedParse, 1000);

    const eventHandler = () => debouncedParse();

    document.body.addEventListener("click", eventHandler, { passive: true });
    document.body.addEventListener("touchstart", eventHandler, {
      passive: true,
    });
  }
})();