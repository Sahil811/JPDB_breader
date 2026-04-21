import { browser } from '../util.js';
import { jsxCreateElement } from '../jsx.js';
import { ShadowComponent } from './shadowbase.js';

const toastContainerElement = jsxCreateElement("div", null);
document.body.append(toastContainerElement);

const toastComponent = new ShadowComponent(toastContainerElement, [
  '/themes.css',
  '/common.css',
  '/content/toast.css'
]);

export function showToast(kind, message, options = {}) {
    const toast = (jsxCreateElement("div", { class: 'toast' },
        jsxCreateElement("span", { class: 'kind' },
            kind,
            ":"),
        jsxCreateElement("span", { class: 'message' }, message),
        jsxCreateElement("span", { class: 'buttons' },
            options.action ? (jsxCreateElement("button", { class: 'action', onclick: options.action }, options.actionIcon ?? 'o')) : (''),
            jsxCreateElement("button", { class: 'close', onclick: () => {
                    toast.remove();
                    clearTimeout(timeout);
                } }, "\u2715"))));
    const timeout = options.timeout != Infinity
        ? setTimeout(() => {
            toast.remove();
        }, options.timeout ?? 3000)
        : undefined;
    toastComponent.append(toast);
}
export function showError(error) {
    console.error(error);
    showToast('Error', error.message, {
        timeout: 5000,
        actionIcon: '⎘',
        action() {
            navigator.clipboard.writeText(`Error: ${error.message}\n${error.stack}`);
            showToast('Info', 'Error copied to clipboard!', { timeout: 1000 });
        },
    });
}
