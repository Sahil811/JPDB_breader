import { loadConfig, getConfig } from './config.js';
import { browser, isChrome, sleep } from '../util.js';
import { addErrorContext, jpdbApi } from '../integrations/api.js';
import * as backend from './backend.js';

export let config = null;

// Initialize config on service worker startup
async function initConfig() {
    config = await loadConfig();
}

// Call init immediately and export a promise that resolves when ready
const configReady = initConfig();

// Export a function to get config (ensures it's loaded)
export function getConfigAsync() {
    return config;
}
class RequestQueue {
    #pending = [];
    #running = false;
    async #run() {
        if (this.#running || this.#pending.length === 0)
            return;
        this.#running = true;
        while (this.#pending.length > 0) {
            const call = this.#pending.shift();
            try {
                const [result, wait] = await call.func();
                call.resolve(result);
                await sleep(wait);
            }
            catch (error) {
                call.reject(error);
                await sleep(1500);
            }
        }
        this.#running = false;
    }
    enqueue(func, resolve = () => { }, reject = () => { }) {
        this.#pending.push({ func, resolve, reject });
        this.#run();
    }
    run(func) {
        return new Promise((resolve, reject) => {
            this.enqueue(func, resolve, reject);
        });
    }
}
const apiQueue = new RequestQueue();
export async function addToDeck(vid, sid, deckId) {
    return apiQueue.run(() => backend.addToDeck(vid, sid, deckId));
}
export async function removeFromDeck(vid, sid, deckId) {
    return apiQueue.run(() => backend.removeFromDeck(vid, sid, deckId));
}
export async function setSentence(vid, sid, sentence, translation) {
    return apiQueue.run(() => backend.setSentence(vid, sid, sentence, translation));
}
export async function review(vid, sid, rating) {
    return apiQueue.run(() => backend.review(vid, sid, rating));
}
export async function getCardState(vid, sid) {
    return apiQueue.run(() => backend.getCardState(vid, sid));
}
const maxParseLength = 16384;
const pendingParagraphs = new Map();
async function batchParses() {
    // Greedily take as many paragraphs as can fit
    let length = 0;
    const strings = [];
    const handles = [];
    for (const [seq, paragraph] of pendingParagraphs) {
        length += paragraph.length;
        if (length > maxParseLength)
            break;
        strings.push(paragraph.text);
        handles.push(paragraph);
        pendingParagraphs.delete(seq);
    }
    if (strings.length === 0)
        return [null, 0];
    try {
        const [[tokens, cards], timeout] = await backend.parse(strings);
        for (const [i, handle] of handles.entries()) {
            handle.resolve(tokens[i]);
        }
        broadcast({ type: 'updateWordState', words: cards.map(card => [card.vid, card.sid, card.state]) });
        return [null, timeout];
    }
    catch (error) {
        for (const handle of handles) {
            handle.reject(error);
        }
        throw error;
    }
}
export function enqueueParse(seq, text) {
    return new Promise((resolve, reject) => {
        pendingParagraphs.set(seq, {
            text,
            // HACK work around the ○○ we will add later
            length: new TextEncoder().encode(text).length + 7,
            resolve,
            reject,
        });
    });
}
export function startParse() {
    apiQueue.enqueue(batchParses);
}
// Content script communication
const ports = new Set();
function post(port, message) {
    port.postMessage(message);
}
function broadcast(message) {
    for (const port of ports)
        port.postMessage(message);
}
function postResponse(port, request, result) {
    port.postMessage({ type: 'success', seq: request.seq, result });
}
function onPortDisconnect(port) {
    console.log('disconnect:', port);
    ports.delete(port);
}
async function broadcastNewWordState(vid, sid) {
    broadcast({ type: 'updateWordState', words: [[vid, sid, await getCardState(vid, sid)]] });
}
// Chrome can't send Error objects over background ports, so we have to serialize and deserialize them...
// (To be specific, Firefox can send any structuredClone-able object, while Chrome can only send JSON-stringify-able objects)
const serializeError = isChrome ? (err) => ({ message: err.message, stack: err.stack }) : (err) => err;
const messageHandlers = {
    async cancel(request, port) {
        // Right now, only parse requests can actually be canceled
        pendingParagraphs.delete(request.seq);
        post(port, { type: 'canceled', seq: request.seq });
    },
    async updateConfig(request, port) {
        const oldCSS = config.customWordCSS;
        config = await loadConfig();
        if (config.customWordCSS !== oldCSS) {
            for (const port of ports) {
                await browser.scripting.insertCSS({
                    target: { tabId: port.sender.tab.id },
                    css: config.customWordCSS,
                    origin: 'AUTHOR'
                });
                await browser.scripting.removeCSS({
                    target: { tabId: port.sender.tab.id },
                    css: oldCSS
                });
            }
        }
        postResponse(port, request, null);
        broadcast({ type: 'updateConfig', config });
    },
    async parse(request, port) {
        for (const [seq, text] of request.texts) {
            enqueueParse(seq, text)
                .then(tokens => post(port, { type: 'success', seq: seq, result: tokens }))
                .catch(error => post(port, { type: 'error', seq: seq, error: serializeError(error) }));
        }
        startParse();
    },
    async setFlag(request, port) {
        const deckId = request.flag === 'blacklist' ? config.blacklistDeckId : config.neverForgetDeckId;
        if (deckId === null) {
            throw Error(`No deck ID set for ${request.flag}, check the settings page`);
        }
        if (request.state === true) {
            await addToDeck(request.vid, request.sid, deckId);
        }
        else {
            await removeFromDeck(request.vid, request.sid, deckId);
        }
        postResponse(port, request, null);
        await broadcastNewWordState(request.vid, request.sid);
    },
    async review(request, port) {
        await review(request.vid, request.sid, request.rating);
        postResponse(port, request, null);
        await broadcastNewWordState(request.vid, request.sid);
    },
    async mine(request, port) {
        if (config.miningDeckId === null) {
            throw Error(`No mining deck ID set, check the settings page`);
        }
        if (request.forq && config.forqDeckId === null) {
            throw Error(`No forq deck ID set, check the settings page`);
        }
        // Safety: This is safe, because we early-errored for this condition
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await addToDeck(request.vid, request.sid, config.miningDeckId);
        if (request.sentence || request.translation) {
            await setSentence(request.vid, request.sid, request.sentence ?? undefined, request.translation ?? undefined);
        }
        if (request.forq) {
            // Safety: This is safe, because we early-errored for this condition
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await addToDeck(request.vid, request.sid, config.forqDeckId);
        }
        if (request.review) {
            await review(request.vid, request.sid, request.review);
        }
        postResponse(port, request, null);
        await broadcastNewWordState(request.vid, request.sid);
    },
    async fetchAudioHash(request, port) {
        const { vid, spelling } = request;
        let html;
        try {
            html = await jpdbApi.fetchVocabularyPage({ vid, spelling });
        }
        catch (error) {
            if (error.status === 404) {
                postResponse(port, request, { hash: null });
                return;
            }
            throw addErrorContext(error, `while fetching audio hash for word ${vid}`);
        }
        const match = html.match(/data-audio="([^"]+)"/);
        postResponse(port, request, { hash: match?.[1] ?? null });
    },
    async fetchAudioBytes(request, port) {
        let buf;
        try {
            buf = await jpdbApi.fetchAudioBytes({ hash: request.hash });
        }
        catch (error) {
            if (error.status === 404) {
                postResponse(port, request, { bytes: null });
                return;
            }
            throw addErrorContext(error, `while fetching audio bytes for hash ${request.hash}`);
        }
        postResponse(port, request, { bytes: Array.from(new Uint8Array(buf)) });
    },
};
async function onPortMessage(message, port) {
    try {
        await messageHandlers[message.type](message, port);
    }
    catch (error) {
        post(port, { type: 'error', seq: message.seq ?? null, error: serializeError(error) });
    }
}
browser.runtime.onConnect.addListener(port => {
    console.log('connect:', port);
    if (port.sender.tab === undefined) {
        // Connection was not from a content script
        port.disconnect();
        return;
    }
    ports.add(port);
    port.onDisconnect.addListener(onPortDisconnect);
    port.onMessage.addListener(onPortMessage);
    // TODO filter to only url-relevant config options
    configReady.then(() => {
        post(port, { type: 'updateConfig', config });
        browser.scripting.insertCSS({
            target: { tabId: port.sender.tab.id },
            css: config.customWordCSS,
            origin: 'AUTHOR'
        });
    });
});
// Context menu (Parse with jpdb)
function portForTab(tabId) {
    for (const port of ports)
        if (port.sender.tab.id === tabId)
            return port;
    return undefined;
}

// Create context menu on install/update
browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
        id: 'parse-selection',
        title: 'Parse 「%s」with jpdb',
        contexts: ['selection'],
    });
});
async function insertCSS(tabId) {
    // We need to await here, because ordering is significant.
    // The custom styles should load after the default styles, so they can overwrite them
    await browser.scripting.insertCSS({
        target: { tabId },
        files: ['/content/word.css'],
        origin: 'AUTHOR'
    });
    if (config.customWordCSS) {
        await browser.scripting.insertCSS({
            target: { tabId },
            css: config.customWordCSS,
            origin: 'AUTHOR'
        });
    }
}
browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'parse-selection') {
        const port = portForTab(tab.id);
        if (port === undefined) {
            // New tab, inject css
            await insertCSS(tab.id);
        }
        await browser.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['/integrations/contextmenu.js']
        });
    }
});
