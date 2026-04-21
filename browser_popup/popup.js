import { loadConfig } from '../background/config.js';
import { browser, nonNull } from '../util.js';
import { jsxCreateElement } from '../jsx.js';

let config = null;

async function parsePage(tab) {
    // Load config if not already loaded
    if (!config) {
        config = await loadConfig();
    }
    
    // Parse the page
    await browser.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['/content/word.css'],
        origin: 'AUTHOR'
    });
    if (config.customWordCSS) {
        await browser.scripting.insertCSS({
            target: { tabId: tab.id },
            css: config.customWordCSS,
            origin: 'AUTHOR'
        });
    }
    await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/integrations/parse_selection.js']
    });
    // Close the popup
    setTimeout(() => window.close(), 10);
}
nonNull(document.querySelector('#settings-link')).addEventListener('click', () => {
    setTimeout(() => window.close(), 10);
});
browser.tabs.query({ active: true }, tabs => {
    const buttonContainer = nonNull(document.querySelector('article'));
    for (const tab of tabs) {
        buttonContainer.append(jsxCreateElement("button", { onclick: () => parsePage(tab) }, `Parse "${tab.title ?? 'Untitled'}"`));
    }
});
