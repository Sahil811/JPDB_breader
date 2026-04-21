import { browser, Canceled, isChrome } from '../util.js';
import { reverseIndex } from './parse.js';
import { Popup } from './popup.js';
import { showError } from './toast.js';
// Background script communication
export let config;
const waitingPromises = new Map();
let nextSeq = 0;
function preregisterUnabortableRequest() {
    const seq = nextSeq++;
    const promise = new Promise((resolve, reject) => {
        waitingPromises.set(seq, { resolve, reject });
    });
    return [seq, promise];
}
function preregisterAbortableRequest() {
    const seq = nextSeq++;
    const abort = new AbortController();
    const promise = new Promise((resolve, reject) => {
        waitingPromises.set(seq, { resolve, reject });
        abort.signal.addEventListener('abort', () => {
            if (port) {
                try {
                    port.postMessage({ type: 'cancel', seq });
                } catch (e) {
                    console.warn('Failed to send cancel message:', e);
                }
            }
        });
    });
    return [seq, promise, abort];
}
// Avoid repetition for most common use case
function requestUnabortable(message) {
    const [seq, promise] = preregisterUnabortableRequest();
    try {
        if (!port) throw new Error('Not connected to background script');
        port.postMessage({ ...message, seq });
    } catch (e) {
        waitingPromises.delete(seq);
        return Promise.reject(e);
    }
    return promise;
}
export function requestSetFlag(card, flag, state) {
    return requestUnabortable({ type: 'setFlag', vid: card.vid, sid: card.sid, flag, state });
}
export function requestFetchAudioHash(vid, spelling) {
    return requestUnabortable({ type: 'fetchAudioHash', vid, spelling });
}
export function requestFetchAudioBytes(hash) {
    return requestUnabortable({ type: 'fetchAudioBytes', hash });
}
export function requestMine(card, forq, sentence, translation) {
    return requestUnabortable({ type: 'mine', forq, vid: card.vid, sid: card.sid, sentence, translation });
}
export function requestReview(card, rating) {
    return requestUnabortable({ type: 'review', rating, vid: card.vid, sid: card.sid });
}
export function requestUpdateConfig() {
    return requestUnabortable({ type: 'updateConfig' });
}
export function createParseBatch(paragraph) {
    const [seq, promise, abort] = preregisterAbortableRequest();
    return { paragraph, promise, abort, seq };
}
// Takes multiple ParseBatches to save on communications overhead between content script and background page
export function requestParse(batches) {
    const texts = batches.map(batch => [batch.seq, batch.paragraph.map(fragment => fragment.node.data).join('')]);
    return requestUnabortable({ type: 'parse', texts });
}
// Chrome can't send Error objects over background ports, so we have to serialize and deserialize them...
// (To be specific, Firefox can send any structuredClone-able object, while Chrome can only send JSON-stringify-able objects)
const deserializeError = isChrome
    ? (err) => {
        const e = new Error(err.message);
        e.stack = err.stack;
        return e;
    }
    : (err) => err;
export let port;

function handleMessage(message) {
    switch (message.type) {
        case 'success':
            {
                const promise = waitingPromises.get(message.seq);
                waitingPromises.delete(message.seq);
                if (promise) {
                    promise.resolve(message.result);
                }
                else {
                    console.warn(`No promise with seq ${message.seq}, result dropped`);
                }
            }
            break;
        case 'error':
            {
                const promise = waitingPromises.get(message.seq);
                waitingPromises.delete(message.seq);
                if (promise) {
                    promise.reject(deserializeError(message.error));
                }
                else {
                    showError(message.error);
                }
            }
            break;
        case 'canceled':
            {
                const promise = waitingPromises.get(message.seq);
                waitingPromises.delete(message.seq);
                if (promise) {
                    promise.reject(new Canceled('Canceled'));
                }
            }
            break;
        case 'updateConfig':
            {
                config = message.config;
                Popup.get().updateStyle();
            }
            break;
        case 'updateWordState':
            {
                for (const [vid, sid, state] of message.words) {
                    const idx = reverseIndex.get(`${vid}/${sid}`);
                    if (idx === undefined)
                        continue;
                    const className = `jpdb-word ${state.join(' ')}`;
                    if (idx.className === className)
                        continue;
                    for (const element of idx.elements) {
                        element.className = className;
                        element.jpdbData.token.card.state = state;
                    }
                    idx.className = className;
                }
                Popup.get().render();
            }
            break;
    }
}

function onDisconnect() {
    let lastError;
    try {
        lastError = browser.runtime.lastError;
    } catch (e) {
        // Context invalidated
    }

    if (lastError?.message?.includes('Extension context invalidated')) {
        console.warn('JPDBreader: Extension context invalidated. Please refresh the page.');
        return;
    }

    console.error('Disconnected from background script:', lastError ? lastError.message : 'Unknown reason');
    
    // Fail all pending promises
    const error = new Error('Connection to background script lost');
    for (const [seq, promise] of waitingPromises) {
        promise.reject(error);
    }
    waitingPromises.clear();
    
    // Reconnect after a delay
    setTimeout(connect, 1000);
}

export function connect() {
    try {
        port = browser.runtime.connect();
        port.onDisconnect.addListener(onDisconnect);
        port.onMessage.addListener(handleMessage);
    } catch (e) {
        if (e.message?.includes('Extension context invalidated')) {
            console.warn('JPDBreader: Extension context invalidated. Reconnection stopped. Please refresh the page.');
            return;
        }
        console.error('Failed to connect to background script:', e);
        setTimeout(connect, 1000);
    }
}

connect();
