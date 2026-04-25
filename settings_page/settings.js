import { loadConfig, migrateSchema, saveConfig } from "../background/config.js";
import { requestUpdateConfig } from "../content/background_comms.js";
import { Popup } from "../content/popup.js";
import { showError } from "../content/toast.js";
import { jpdbApi } from "../integrations/api.js";
import { assert, nonNull, wrap } from "../util.js";
import { defineCustomElements } from "./elements.js";
// Custom element definitions
// Common behavior shared for all settings elements

function applyTheme(theme) {
  if (theme && theme !== 'auto') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

const POPUP_EXAMPLE_DATA = {
  context: "",
  contextOffset: 0,
  token: {
    start: 0,
    end: 0,
    length: 0,
    rubies: [],
    card: {
      vid: 1386060,
      sid: 1337383451,
      rid: 0,
      spelling: "設定",
      reading: "せってい",
      pitchAccent: ["LHHHH"],
      meanings: [
        {
          partOfSpeech: ["n", "vs"],
          glosses: [
            "establishment",
            "creation",
            "posing (a problem)",
            "setting (movie, novel, etc.)",
            "scene",
          ],
        },
        {
          partOfSpeech: ["n", "vs"],
          glosses: [
            "options setting",
            "preference settings",
            "configuration",
            "setup",
          ],
        },
      ],
      state: ["locked", "new"],
      frequencyRank: 2400,
    },
  },
};
let hasUnsavedChanges = false;
export function markUnsavedChanges() {
  document.body.classList.add("has-unsaved-changes");
  hasUnsavedChanges = true;
}
export function unmarkUnsavedChanges() {
  document.body.classList.remove("has-unsaved-changes");
  hasUnsavedChanges = false;
}
addEventListener(
  "beforeunload",
  (event) => {
    if (hasUnsavedChanges) {
      event.preventDefault();
      event.returnValue = "";
    }
  },
  { capture: true }
);
try {
  // Load config asynchronously
  let config = null;
  
  (async () => {
    config = await loadConfig();
    
    // Populate form fields with config values
    for (const elem of document.querySelectorAll("[name]")) {
      elem.value = config[elem.name] ?? null;
    }

    // Apply theme to settings page and preview popup
    applyTheme(config.theme);
    popup.updateStyle(config.customPopupCSS, config.theme);
  })();
  
  defineCustomElements();
  nonNull(document.querySelector("#export")).addEventListener(
    "click",
    async () => {
      try {
        // if (window.showSaveFilePicker) {
        //     await window.showSaveFilePicker({
        //         suggestedName: 'jpdbreader-settings.json',
        //         types: [
        //             {
        //                 description: 'JSON file',
        //                 accept: { 'application/json': ['.json'] },
        //             },
        //         ],
        //     });
        // } else {
        const a = document.createElement("a");
        a.download = "jpdbreader-settings.json";
        a.href = `data:application/json,${encodeURIComponent(
          JSON.stringify(config, null, 4)
        )}`;
        a.click();
        // }
      } catch (error) {
        showError(error);
      }
    }
  );
  const inputFilePicker = nonNull(
    document.querySelector("#import-file-picker")
  );
  inputFilePicker.addEventListener("change", async () => {
    try {
      const files = inputFilePicker.files;
      if (files === null || files.length === 0) return;
      const fileContents = await wrap(
        new FileReader(),
        (reader, resolve, reject) => {
          reader.onload = () => {
            assert(
              typeof reader.result === "string",
              "File Reader returned incorrect result type"
            );
            resolve(reader.result);
          };
          reader.onerror = () =>
            reject({ message: "Error occurred while reading file" });
          reader.readAsText(files[0]);
        }
      );
      try {
        const data = JSON.parse(fileContents);
        migrateSchema(data);
        Object.assign(config, data);
        for (const elem of document.querySelectorAll("[name]")) {
          elem.value = config[elem.name] ?? null;
        }
        markUnsavedChanges();
      } catch (error) {
        alert(`Could not import config: ${error.message}`);
      }
    } catch (error) {
      showError(error);
    }
  });
  nonNull(document.querySelector("#import")).addEventListener("click", () => {
    inputFilePicker.click();
  });
  // Export Vocabulary as CSV
  nonNull(document.querySelector("#export-vocab")).addEventListener("click", async () => {
    try {
      const tabs = await new Promise(resolve => {
        (globalThis.browser ?? chrome).tabs.query({ active: true, currentWindow: true }, resolve);
      });
      const tab = tabs?.[0];
      let words = [];
      if (tab) {
        try {
          const results = await (globalThis.browser ?? chrome).scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const elements = document.querySelectorAll('.jpdb-word:not(.unparsed)');
              const seen = new Set();
              const rows = [];
              for (const el of elements) {
                const data = el.jpdbData;
                if (!data) continue;
                const card = data.token.card;
                const key = `${card.vid}/${card.sid}`;
                if (seen.has(key)) continue;
                seen.add(key);
                const meaning = card.meanings?.[0]?.glosses?.join('; ') ?? '';
                rows.push({
                  word: card.spelling,
                  reading: card.reading,
                  meaning,
                  state: card.state?.join(', ') ?? 'unknown',
                  date_added: new Date().toISOString().split('T')[0],
                });
              }
              return rows;
            },
          });
          words = results?.[0]?.result ?? [];
        } catch (_) {
          // No content script on this tab
        }
      }
      if (words.length === 0) {
        alert('No parsed vocabulary found on the current page. Make sure a page with parsed Japanese text is active.');
        return;
      }
      const csvHeader = 'word,reading,meaning,state,date_added';
      const escape = (s) => `"${String(s).replace(/"/g, '""')}"`;
      const csvRows = words.map(w => [escape(w.word), escape(w.reading), escape(w.meaning), escape(w.state), escape(w.date_added)].join(','));
      const csv = [csvHeader, ...csvRows].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jpdb-vocabulary-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(error);
    }
  });
  const popup = Popup.getDemoMode(nonNull(document.querySelector("#preview")));
  popup.setData(POPUP_EXAMPLE_DATA);
  popup.fadeIn();
  nonNull(document.querySelector('[name="customPopupCSS"]')).addEventListener(
    "input",
    (event) => {
      const newCSS = event.target.value;
      const currentTheme = themeSelect?.value || config?.theme;
      popup.updateStyle(newCSS, currentTheme);
    }
  );
  // Update theme live when the select changes
  const themeSelect = document.querySelector('[name="theme"]');
  if (themeSelect) {
    themeSelect.addEventListener("input", () => {
      const theme = themeSelect.value;
      applyTheme(theme);
      popup.updateStyle(undefined, theme);
    });
  }
  const saveButton = nonNull(document.querySelector("input[type=submit]"));
  saveButton.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      if (!config) {
        config = await loadConfig();
      }
      for (const name of Object.keys(config)) {
        const elem = document.querySelector(`[name="${name}"]`);
        if (elem !== null) {
          const newValue = elem.value;
          config[name] = newValue;
        }
      }
      await saveConfig(config);
      await requestUpdateConfig();
      applyTheme(config.theme);
      popup.updateStyle(config.customPopupCSS, config.theme);
      popup.render();
      unmarkUnsavedChanges();
    } catch (error) {
      showError(error);
    }
  });
  // Test API token connection
  const testBtn = document.querySelector("#test-api-token");
  const testResult = document.querySelector("#test-api-result");
  if (testBtn && testResult) {
    testBtn.addEventListener("click", async () => {
      const tokenElem = document.querySelector('[name="apiToken"]');
      const token = tokenElem?.value;
      if (!token) {
        testResult.textContent = "⚠ No token entered";
        testResult.style.color = "var(--md-sys-color-warning, orange)";
        return;
      }
      testBtn.disabled = true;
      testResult.textContent = "Testing…";
      testResult.style.color = "var(--md-sys-color-on-surface-variant, gray)";
      try {
        await jpdbApi.lookupVocabulary({
          apiToken: token,
          list: [[1386060, 1337383451]],
          fields: ["vid"],
        });
        testResult.textContent = "✓ Connection successful";
        testResult.style.color = "var(--md-sys-color-success, green)";
      } catch (error) {
        const status = error.status;
        if (status === 403) {
          testResult.textContent = "✗ Invalid API token";
        } else {
          testResult.textContent = `✗ ${error.message || "Connection failed"}`;
        }
        testResult.style.color = "var(--md-sys-color-error, red)";
      } finally {
        testBtn.disabled = false;
      }
    });
  }
} catch (error) {
  showError(error);
}
