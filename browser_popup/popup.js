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

// Collect stats from the active tab
async function collectStats(tab) {
    try {
        const results = await browser.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const allWords = document.querySelectorAll('.jpdb-word:not(.unparsed)');
                const unknown = document.querySelectorAll('.jpdb-word.not-in-deck, .jpdb-word.new');
                const known = document.querySelectorAll('.jpdb-word.known, .jpdb-word.never-forget');
                return {
                    total: allWords.length,
                    unknown: unknown.length,
                    known: known.length,
                };
            },
        });
        const stats = results?.[0]?.result;
        if (stats && stats.total > 0) {
            document.getElementById('stat-total').textContent = stats.total;
            document.getElementById('stat-unknown').textContent = stats.unknown;
            document.getElementById('stat-known').textContent = stats.known;
            document.getElementById('stats-section').style.display = '';
            // Show mine button if there are unknown words
            if (stats.unknown > 0) {
                const mineBtn = document.getElementById('mine-all-btn');
                mineBtn.style.display = '';
                mineBtn.textContent = `Mine all unknown words (${stats.unknown})`;
            }
        }
    } catch (_) {
        // Tab may not have content script injected — stats section stays hidden
    }
}

// Collect unknown words and batch-mine them
async function mineAllUnknown(tab) {
    const mineBtn = document.getElementById('mine-all-btn');
    const progress = document.getElementById('mine-progress');
    mineBtn.disabled = true;
    progress.style.display = '';
    progress.textContent = 'Collecting words…';

    try {
        const results = await browser.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const elements = document.querySelectorAll('.jpdb-word.not-in-deck, .jpdb-word.new');
                const seen = new Set();
                const words = [];
                for (const el of elements) {
                    const data = el.jpdbData;
                    if (!data) continue;
                    const key = `${data.token.card.vid}/${data.token.card.sid}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    words.push({
                        vid: data.token.card.vid,
                        sid: data.token.card.sid,
                        spelling: data.token.card.spelling,
                        reading: data.token.card.reading,
                    });
                }
                return words;
            },
        });

        const words = results?.[0]?.result;
        if (!words || words.length === 0) {
            progress.textContent = 'No unknown words found.';
            return;
        }

        progress.textContent = `Adding 0/${words.length} words…`;

        const response = await browser.runtime.sendMessage({
            type: 'batchMine',
            words,
        });

        if (response.success) {
            const r = response.results;
            progress.textContent = `Done! Added ${r.added}/${r.added + r.failed} words.`;
            if (r.failed > 0) {
                progress.textContent += ` (${r.failed} failed)`;
            }
            // Refresh stats
            await collectStats(tab);
        } else {
            progress.textContent = `Error: ${response.error}`;
        }
    } catch (error) {
        progress.textContent = `Error: ${error.message}`;
    } finally {
        mineBtn.disabled = false;
    }
}

nonNull(document.querySelector('#settings-link')).addEventListener('click', () => {
    setTimeout(() => window.close(), 10);
});

browser.tabs.query({ active: true, currentWindow: true }, async tabs => {
    const buttonContainer = nonNull(document.querySelector('article'));
    const activeTab = tabs[0];

    // Collect stats for the active tab
    if (activeTab) {
        await collectStats(activeTab);
        document.getElementById('mine-all-btn').addEventListener('click', () => mineAllUnknown(activeTab));
    }

    // Add parse buttons for all active tabs
    browser.tabs.query({ active: true }, allTabs => {
        for (const tab of allTabs) {
            buttonContainer.append(jsxCreateElement("button", { onclick: () => parsePage(tab) }, `Parse "${tab.title ?? 'Untitled'}"`));
        }
    });
});
