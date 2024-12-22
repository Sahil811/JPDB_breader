(async () => {
  "use strict";

  // Initialize browser global
  const $browser = globalThis.browser ?? globalThis.chrome;

  // Import helper function
  const importModule = (path) => import($browser.runtime.getURL(path));

  // Import required modules
  const { browser } = await importModule("/util.js");
  const { paragraphsInNode, parseParagraphs } = await importModule(
    "/integrations/common.js"
  );
  const { requestParse } = await importModule("/content/background_comms.js");
  const { showError } = await importModule("/content/toast.js");

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

  function isSpecificSite() {
    const currentURL = window.location.href;
    const specificSites = ["ankiuser.net", "ankiweb.net", "jpdb.io"];
    return specificSites.some((site) => currentURL.includes(site));
  }

  async function handleParse() {
    try {
      await browser.runtime.sendMessage({
        action: "executeContextMenu",
      });
      runScript();
    } catch (error) {
      showError(error);
    }
  }

  function createParseButton() {
    // First check if button already exists and remove it
    const existingButton = document.getElementById("parse-button");
    if (existingButton) {
      existingButton.remove();
    }

    const button = document.createElement("button");
    button.id = "parse-button";
    button.title = "Parse Japanese Text";
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v15"/>
          <path d="M8 9h8"/>
          <path d="M4 18h16"/>
          <path d="M6 12h4"/>
          <text x="16" y="12" font-size="8" fill="currentColor">あ</text>
          <circle cx="18" cy="6" r="3" fill="none"/>
      </svg>
    `;

    // Store initial position
    let buttonPosition = {
      right: "20px",
      bottom: "20px",
    };

    Object.assign(button.style, {
      position: "fixed",
      right: buttonPosition.right,
      bottom: buttonPosition.bottom,
      padding: "10px",
      border: "none",
      borderRadius: "50%",
      width: "45px",
      height: "45px",
      cursor: "pointer",
      backgroundColor: "#6200ea",
      color: "white",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "none", // Remove transition for smoother dragging
      boxShadow: "0 3px 6px rgba(0,0,0,0.16)",
      zIndex: "999999",
      userSelect: "none",
    });

    // Drag functionality
    let isDragging = false;
    let startX, startY;
    let initialX, initialY;

    function handleMouseDown(e) {
      if (e.button !== 0) return; // Only handle left mouse button

      isDragging = true;

      // Get current button position
      const rect = button.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      initialX = rect.left;
      initialY = rect.top;

      // Change to absolute positioning for dragging
      button.style.position = "fixed";
      button.style.right = "auto";
      button.style.bottom = "auto";
      button.style.left = initialX + "px";
      button.style.top = initialY + "px";

      e.preventDefault(); // Prevent text selection
    }

    function handleMouseMove(e) {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const newX = initialX + deltaX;
      const newY = initialY + deltaY;

      // Keep button within viewport bounds
      const maxX = window.innerWidth - button.offsetWidth;
      const maxY = window.innerHeight - button.offsetHeight;

      button.style.left = Math.min(Math.max(0, newX), maxX) + "px";
      button.style.top = Math.min(Math.max(0, newY), maxY) + "px";
    }

    function handleMouseUp() {
      isDragging = false;
    }

    // Add click handler for parsing
    button.addEventListener("click", (e) => {
      if (!isDragging) {
        handleParse();
      }
    });

    // Add drag event listeners
    button.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Hover effects
    button.addEventListener("mouseover", () => {
      if (!isDragging) {
        button.style.backgroundColor = "#3700b3";
        button.style.boxShadow = "0 8px 17px rgba(0,0,0,0.2)";
      }
    });

    button.addEventListener("mouseout", () => {
      if (!isDragging) {
        button.style.backgroundColor = "#6200ea";
        button.style.boxShadow = "0 3px 6px rgba(0,0,0,0.16)";
      }
    });

    document.body.appendChild(button);
    return button;
  }

  // Main execution
  if (isSpecificSite()) {
    createParseButton();
  }
  setTimeout(runScript, 300);
})();
