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
                const exportBtn = document.getElementById('export-words-btn');
                exportBtn.style.display = '';
                exportBtn.textContent = `Export unknown words (${stats.unknown})`;
            }
        }
    } catch (_) {
        // Tab may not have content script injected — stats section stays hidden
    }
}

// Collect unknown words and export as Anki-compatible TSV
async function exportUnknownWords(tab) {
    const exportBtn = document.getElementById('export-words-btn');
    const progress = document.getElementById('export-progress');
    exportBtn.disabled = true;
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
                    const card = data.token.card;
                    const key = `${card.vid}/${card.sid}`;
                    if (seen.has(key)) continue;
                    seen.add(key);

                    // Get sentence context
                    let sentence = '';
                    try {
                        const ctx = data.context || '';
                        sentence = ctx.trim().substring(0, 200);
                    } catch (_) {}

                    words.push({
                        spelling: card.spelling || '',
                        reading: card.reading || '',
                        meanings: (card.meanings || []).join('; '),
                        partOfSpeech: (card.partOfSpeech || []).join(', '),
                        frequency: card.frequencyRank || '',
                        state: (card.state || []).join(', '),
                        sentence,
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

        // Build TSV content (Anki-compatible)
        const header = ['Word', 'Reading', 'Meaning', 'Part of Speech', 'Frequency Rank', 'State', 'Example Sentence'];
        const rows = words.map(w =>
            [w.spelling, w.reading, w.meanings, w.partOfSpeech, w.frequency, w.state, w.sentence]
                .map(v => String(v ?? '').replace(/\t/g, ' ').replace(/\n/g, ' '))
                .join('\t')
        );
        const tsv = header.join('\t') + '\n' + rows.join('\n');

        // Download as file
        const blob = new Blob(['\ufeff' + tsv], { type: 'text/tab-separated-values;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const pageTitle = (await browser.tabs.get(tab.id))?.title || 'jpdb-words';
        const safeName = pageTitle.replace(/[^a-zA-Z0-9_\u3000-\u9fff\uff00-\uffef]/g, '_').substring(0, 50);
        a.download = `${safeName}_unknown_words.tsv`;
        a.click();
        URL.revokeObjectURL(url);

        progress.textContent = `Exported ${words.length} words!`;
    } catch (error) {
        progress.textContent = `Error: ${error.message}`;
    } finally {
        exportBtn.disabled = false;
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
        document.getElementById('export-words-btn').addEventListener('click', () => exportUnknownWords(activeTab));
    }

    // Add parse buttons for all active tabs
    browser.tabs.query({ active: true }, allTabs => {
        for (const tab of allTabs) {
            buttonContainer.append(jsxCreateElement("button", { onclick: () => parsePage(tab) }, `Parse "${tab.title ?? 'Untitled'}"`));
        }
    });
});
