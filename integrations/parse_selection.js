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

  // Function to execute the parsing logic
  async function runScript() {
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
  }

  // Check the URL and run the script accordingly
  function checkURLAndRun() {
    const currentURL = window.location.href;
    if (
      currentURL.includes("ankiuser.net") ||
      currentURL.includes("ankiweb.net") ||
      currentURL.includes("https://jpdb.io")
    ) {
      runScript();
    }
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

  // Run the script immediately for other websites
  runScript();

  // Run the script every 3 seconds for Anki websites
  setInterval(checkURLAndRun, 1000);
})();
