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
                document.getElementById('word-actions').style.display = '';
                document.getElementById('export-words-btn').textContent = `📥 Export (${stats.unknown})`;
                document.getElementById('review-words-btn').textContent = `🎴 Review (${stats.unknown})`;
            }
        }
    } catch (_) {
        // Tab may not have content script injected — stats section stays hidden
    }
}

// Collect unknown words and export as Anki-compatible TSV
async function collectUnknownWords(tab) {
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

                let sentence = '';
                try {
                    sentence = (data.context || '').trim().substring(0, 200);
                } catch (_) {}

                words.push({
                    spelling: card.spelling || '',
                    reading: card.reading || '',
                    meanings: (card.meanings || []).map(m => (m.glosses || []).join(', ')).join('; '),
                    partOfSpeech: (card.partOfSpeech || []).join(', '),
                    frequency: card.frequencyRank || '',
                    state: (card.state || []).join(', '),
                    sentence,
                });
            }
            return words;
        },
    });
    return results?.[0]?.result || [];
}

async function exportUnknownWords(tab) {
    const exportBtn = document.getElementById('export-words-btn');
    const progress = document.getElementById('action-progress');
    exportBtn.disabled = true;
    progress.style.display = '';
    progress.textContent = 'Collecting words…';

    try {
        const words = await collectUnknownWords(tab);
        if (words.length === 0) {
            progress.textContent = 'No unknown words found.';
            return;
        }

        // Get source URL for the export
        const tabInfo = await browser.tabs.get(tab.id);
        const sourceUrl = tabInfo?.url || '';
        let siteName = 'jpdb_words';
        try {
            const hostname = new URL(sourceUrl).hostname.replace(/^www\./, '');
            siteName = hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
        } catch (_) {}

        const header = ['Word', 'Reading', 'Meaning', 'Part of Speech', 'Frequency Rank', 'State', 'Example Sentence', 'Source'];
        const rows = words.map(w =>
            [w.spelling, w.reading, w.meanings, w.partOfSpeech, w.frequency, w.state, w.sentence, sourceUrl]
                .map(v => String(v ?? '').replace(/\t/g, ' ').replace(/\n/g, ' '))
                .join('\t')
        );
        const tsv = header.join('\t') + '\n' + rows.join('\n');

        const blob = new Blob(['\ufeff' + tsv], { type: 'text/tab-separated-values;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `${siteName}_${date}_unknown_words.tsv`;
        a.click();
        URL.revokeObjectURL(url);

        progress.textContent = `Exported ${words.length} words!`;
    } catch (error) {
        progress.textContent = `Error: ${error.message}`;
    } finally {
        exportBtn.disabled = false;
    }
}

// Flashcard review mode
let flashcardWords = [];
let flashcardIndex = 0;
let flashcardRevealed = false;

function renderFlashcard() {
    const container = document.getElementById('flashcard-container');
    const counter = document.getElementById('flashcard-counter');
    const word = flashcardWords[flashcardIndex];
    if (!word) return;
    counter.textContent = `${flashcardIndex + 1} / ${flashcardWords.length}`;
    flashcardRevealed = false;

    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'flashcard';
    const wordEl = document.createElement('div');
    wordEl.className = 'fc-word';
    wordEl.textContent = word.spelling;
    const hintEl = document.createElement('div');
    hintEl.className = 'fc-tap-hint';
    hintEl.textContent = 'tap to reveal';
    card.append(wordEl, hintEl);
    card.addEventListener('click', () => revealFlashcard(card, word));
    container.appendChild(card);
}

function revealFlashcard(card, word) {
    if (flashcardRevealed) return;
    flashcardRevealed = true;
    card.innerHTML = '';
    const wordEl = document.createElement('div');
    wordEl.className = 'fc-word';
    wordEl.textContent = word.spelling;
    const divider = document.createElement('div');
    divider.className = 'fc-divider';
    const readingEl = document.createElement('div');
    readingEl.className = 'fc-reading';
    readingEl.textContent = word.reading;
    const meaningEl = document.createElement('div');
    meaningEl.className = 'fc-meaning';
    meaningEl.textContent = word.meanings;
    card.append(wordEl, divider, readingEl, meaningEl);
    if (word.sentence) {
        const sentenceEl = document.createElement('div');
        sentenceEl.className = 'fc-sentence';
        sentenceEl.textContent = word.sentence;
        card.appendChild(sentenceEl);
    }
}

async function startFlashcardReview(tab) {
    const progress = document.getElementById('action-progress');
    progress.style.display = '';
    progress.textContent = 'Collecting words…';

    try {
        const words = await collectUnknownWords(tab);
        if (words.length === 0) {
            progress.textContent = 'No unknown words found.';
            return;
        }

        // Shuffle words
        for (let i = words.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [words[i], words[j]] = [words[j], words[i]];
        }

        flashcardWords = words;
        flashcardIndex = 0;
        progress.style.display = 'none';

        // Show flashcard UI, hide main UI
        document.getElementById('main-content').style.display = 'none';
        document.getElementById('flashcard-section').style.display = '';
        renderFlashcard();
    } catch (error) {
        progress.textContent = `Error: ${error.message}`;
    }
}

function flashcardNav(direction) {
    flashcardIndex = Math.max(0, Math.min(flashcardWords.length - 1, flashcardIndex + direction));
    renderFlashcard();
}

function exitFlashcards() {
    document.getElementById('flashcard-section').style.display = 'none';
    document.getElementById('main-content').style.display = '';
}

nonNull(document.querySelector('#settings-link')).addEventListener('click', () => {
    setTimeout(() => window.close(), 10);
});

browser.tabs.query({ active: true, currentWindow: true }, async tabs => {
    const buttonContainer = nonNull(document.querySelector('.popup-body'));
    const activeTab = tabs[0];

    // Collect stats for the active tab
    if (activeTab) {
        await collectStats(activeTab);
        document.getElementById('export-words-btn').addEventListener('click', () => exportUnknownWords(activeTab));
        document.getElementById('review-words-btn').addEventListener('click', () => startFlashcardReview(activeTab));
    }

    // Flashcard navigation
    document.getElementById('fc-prev').addEventListener('click', () => flashcardNav(-1));
    document.getElementById('fc-next').addEventListener('click', () => flashcardNav(1));
    document.getElementById('fc-exit').addEventListener('click', exitFlashcards);
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('flashcard-section').style.display === 'none') return;
        if (e.key === 'ArrowLeft') flashcardNav(-1);
        else if (e.key === 'ArrowRight') flashcardNav(1);
        else if (e.key === ' ' || e.key === 'Enter') {
            const card = document.querySelector('.flashcard');
            if (card && !flashcardRevealed) {
                const word = flashcardWords[flashcardIndex];
                revealFlashcard(card, word);
            }
            e.preventDefault();
        }
        else if (e.key === 'Escape') exitFlashcards();
    });

    // Add parse buttons for all active tabs
    browser.tabs.query({ active: true }, allTabs => {
        for (const tab of allTabs) {
            buttonContainer.append(jsxCreateElement("button", { onclick: () => parsePage(tab) }, `Parse "${tab.title ?? 'Untitled'}"`));
        }
    });
});
