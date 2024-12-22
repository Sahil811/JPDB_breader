(async () => {
  "use strict";
  const $browser = globalThis.browser ?? globalThis.chrome,
    $import = (path) => import($browser.runtime.getURL(path));
  const { browser } = await $import("/util.js");
  const { paragraphsInNode, parseParagraphs } = await $import(
    "/integrations/common.js"
  );
  const { requestParse } = await $import("/content/background_comms.js");
  const { showError } = await $import("/content/toast.js");

  // Function to check if current site is in the specific list
  function isSpecificSite() {
    const currentURL = window.location.href;
    const specificSites = ["ankiuser.net", "ankiweb.net", "jpdb.io"];
    return specificSites.some((site) => currentURL.includes(site));
  }

  // Create the button element
  const parse_page = document.createElement("button");
  parse_page.innerHTML = "Parse selection";
  Object.assign(parse_page.style, {
    position: "fixed",
    top: "0",
    right: "0",
    zIndex: "9999",
  });
  document.body.appendChild(parse_page);

  parse_page?.addEventListener("click", () => {
    browser.tabs.executeScript({ file: "/integrations/contextmenu.js" });
  });

  // Run the original parsing code
  try {
    const paragraphs = paragraphsInNode(document.body);
    if (paragraphs.length > 0) {
      const [batches, applied] = parseParagraphs(paragraphs);
      requestParse(batches);
      Promise.allSettled(applied);
    }
  } catch (error) {
    showError(error);
  }

  // Only add click handling for specific sites
  if (isSpecificSite()) {
    // Function to handle parsing on click
    const handleClick = async (event) => {
      try {
        const paragraphs = paragraphsInNode(document.body);
        if (paragraphs.length > 0) {
          const [batches, applied] = parseParagraphs(paragraphs);
          requestParse(batches);
          await Promise.allSettled(applied);
        }
      } catch (error) {
        showError(error);
      }
    };

    // Add click and touch event listeners only for the body element
    document.body.addEventListener("click", handleClick, { passive: true });
    document.body.addEventListener("touchstart", handleClick, {
      passive: true,
    });
  }
})();
