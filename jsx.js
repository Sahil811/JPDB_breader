import { showError } from "./content/toast.js";

export function jsxCreateElement(name, props, ...content) {
  const elem = document.createElement(name);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key.startsWith("on")) {
        if (value instanceof Function) {
          elem.addEventListener(key.replace(/^on/, ""), async (...args) => {
            try {
              await value(...args);
            } catch (error) {
              showError(error);
            }
          });
        } else {
          elem.addEventListener(key.replace(/^on/, ""), value);
        }
      } else if (key === "openInPopup" && value === true && name === "a") {
        elem.addEventListener("click", (event) => {
          event.preventDefault();
          const screenWidth = window.screen.width;
          const screenHeight = window.screen.height;
          const popupWidth = 700; // specify your desired width
          const popupHeight = 600; // specify your desired height
          const left = (screenWidth - popupWidth) / 2;
          const top = (screenHeight - popupHeight) / 2;
          const popup = window.open(
            props.href,
            "_blank",
            `width=${popupWidth},height=${popupHeight},left=${left},top=${top}`
          );
          if (popup) {
            popup.focus(); // bring the new window into focus in case it's not
          }
        });
      } else if (value !== false) {
        elem.setAttribute(key, value);
      }
    }
  }
  elem.append(...content.flat());
  return elem;
}
