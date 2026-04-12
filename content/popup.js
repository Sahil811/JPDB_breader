import { browser, clamp, nonNull } from "../util.js";
import { jsxCreateElement } from "../jsx.js";
import {
  config,
  requestMine,
  requestReview,
  requestSetFlag,
  requestFetchAudioHash,
  requestFetchAudioBytes,
} from "./background_comms.js";
import { Dialog } from "./dialog.js";
import { getSentences } from "./word.js";
import { JapaneseDictionary } from "../dictionary.js";
const PARTS_OF_SPEECH = {
  n: "Noun",
  pn: "Pronoun",
  pref: "Prefix",
  suf: "Suffix",
  // 'n-adv': '', // Not used in jpdb: n + adv instead. JMDict: "adverbial noun (fukushitekimeishi)"
  // 'n-pr': '', // Not used in jpdb: name instead. JMDict: "proper noun"
  // 'n-pref': '', // Not used in jpdb: n + pref instead. JMDict: "noun, used as a prefix"
  // 'n-suf': '', // Not used in jpdb: n + suf instead. JMDict: "noun, used as a suffix"
  // 'n-t': '', // Not used in jpdb: n instead. JMDict: "noun (temporal) (jisoumeishi)"
  // 'n-pr': '', // JMDict: "proper noun"
  name: "Name",
  "name-fem": "Name (Feminine)",
  "name-male": "Name (Masculine)",
  "name-surname": "Surname",
  "name-person": "Personal Name",
  "name-place": "Place Name",
  "name-company": "Company Name",
  "name-product": "Product Name",
  "adj-i": "Adjective",
  "adj-na": "な-Adjective",
  "adj-no": "の-Adjective",
  "adj-pn": "Adjectival",
  "adj-nari": "なり-Adjective (Archaic/Formal)",
  "adj-ku": "く-Adjective (Archaic)",
  "adj-shiku": "しく-Adjective (Archaic)",
  // 'adj-ix': 'Adjective (いい/よい irregular)', // Not used in jpdb, adj-i instead. JMDict: "adjective (keiyoushi) - yoi/ii class"
  // 'adj-f': '', // Not used in jpdb. JMDict: "noun or verb acting prenominally"
  // 'adj-t': '', // Not used in jpdb. JMDict: "'taru' adjective"
  // 'adj-kari': '', // Not used in jpdb. JMDict: "'kari' adjective (archaic)"
  adv: "Adverb",
  // 'adv-to': '', // Not used in jpdb: adv instead. JMDict: "adverb taking the `to' particle"
  aux: "Auxiliary",
  "aux-v": "Auxiliary Verb",
  "aux-adj": "Auxiliary Adjective",
  conj: "Conjunction",
  cop: "Copula",
  ctr: "Counter",
  exp: "Expression",
  int: "Interjection",
  num: "Numeric",
  prt: "Particle",
  // 'cop-da': '',  // Not used in jpdb: cop instead. JMDict: "copula"
  vt: "Transitive Verb",
  vi: "Intransitive Verb",
  v1: "Ichidan Verb",
  "v1-s": "Ichidan Verb (くれる Irregular)",
  v5: "Godan Verb",
  v5u: "う Godan Verb",
  "v5u-s": "う Godan Verb (Irregular)",
  v5k: "く Godan Verb",
  "v5k-s": "く Godan Verb (いく/ゆく Irregular)",
  v5g: "ぐ Godan Verb",
  v5s: "す Godan Verb",
  v5t: "つ Godan Verb",
  v5n: "ぬ Godan Verb",
  v5b: "ぶ Godan Verb",
  v5m: "む Godan Verb",
  v5r: "る Godan Verb",
  "v5r-i": "る Godan Verb (Irregular)",
  v5aru: "る Godan Verb (-ある Irregular)",
  // 'v5uru': '', // JMDict: "Godan verb - Uru old class verb (old form of Eru)"
  vk: "Irregular Verb (くる)",
  // vn: '', // Not used in jpdb. JMDict: "irregular nu verb"
  // vr: '', // Not used in jpdb. JMDict: "irregular ru verb, plain form ends with -ri"
  vs: "する Verb",
  vz: "ずる Verb",
  "vs-c": "す Verb (Archaic)",
  // 'vs-s': '', // Not used in jpdb. JMDict: "suru verb - special class"
  // 'vs-i': '', // JMDict: "suru verb - included"
  // iv: '',  // Not used in jpdb. JMDict: "irregular verb"
  // 'v-unspec': '', // Not used in jpdb. JMDIct: "verb unspecified"
  v2: "Nidan Verb (Archaic)",
  // 'v2a-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb with 'u' ending (archaic)"
  // 'v2b-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'bu' ending (archaic)"
  // 'v2b-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'bu' ending (archaic)"
  // 'v2d-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'dzu' ending (archaic)"
  // 'v2d-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'dzu' ending (archaic)"
  // 'v2g-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'gu' ending (archaic)"
  // 'v2g-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'gu' ending (archaic)"
  // 'v2h-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'hu/fu' ending (archaic)"
  // 'v2h-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'hu/fu' ending (archaic)"
  // 'v2k-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'ku' ending (archaic)"
  // 'v2k-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'ku' ending (archaic)"
  // 'v2m-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'mu' ending (archaic)"
  // 'v2m-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'mu' ending (archaic)"
  // 'v2n-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'nu' ending (archaic)"
  // 'v2r-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'ru' ending (archaic)"
  // 'v2r-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'ru' ending (archaic)"
  // 'v2s-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'su' ending (archaic)"
  // 'v2t-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'tsu' ending (archaic)"
  // 'v2t-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'tsu' ending (archaic)"
  // 'v2w-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'u' ending and 'we' conjugation (archaic)"
  // 'v2y-k': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (upper class) with 'yu' ending (archaic)"
  // 'v2y-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'yu' ending (archaic)"
  // 'v2z-s': '', // Not used in jpdb: v2 instead. JMDict: "Nidan verb (lower class) with 'zu' ending (archaic)"
  v4: "Yodan Verb (Archaic)",
  v4k: "",
  v4g: "",
  v4s: "",
  v4t: "",
  v4h: "",
  v4b: "",
  v4m: "",
  v4r: "",
  // v4n: '', // Not used in jpdb. JMDict: "Yodan verb with 'nu' ending (archaic)"
  va: "Archaic", // Not from JMDict? TODO Don't understand this one, seems identical to #v4n ?
  // 'unc': '', // Not used in jpdb: empty list instead. JMDict: "unclassified"
};

const dictionary = new JapaneseDictionary();
let dictionaryLoaded = false;

const loadDictionary = async () => {
  if (!config.showHindi) return;
  if (dictionaryLoaded) return;
  try {
    await dictionary.loadDictionary();
    dictionaryLoaded = true;
  } catch (error) {
    console.error("Failed to load dictionary:", error);
  }
};

// Load kanji meanings from JSON file
const loadKanjiMeanings = async () => {
  try {
    // Log the attempted URL for debugging
    const resourceUrl = chrome.runtime.getURL("kanji_meanings.json");

    // Check if the file exists first
    if (!resourceUrl) {
      throw new Error("Could not generate URL for kanji_meanings.json");
    }

    const response = await fetch(resourceUrl);

    // Detailed error logging
    if (!response.ok) {
      throw new Error(
        `HTTP error! Status: ${response.status}, Text: ${await response.text()}`
      );
    }

    const data = await response.json();

    // Validate the data structure
    if (!Array.isArray(data) && typeof data !== "object") {
      throw new Error("Invalid data format: Expected array or object");
    }

    return data;
  } catch (error) {
    // Enhanced error logging
    console.error("Failed to load kanji meanings:", {
      error: error.message,
      stack: error.stack,
      resourceUrl: chrome.runtime.getURL("kanji_meanings.json"),
    });

    // You might want to throw the error instead of returning empty array
    // depending on how critical this data is for your extension
    throw new Error(`Failed to load kanji meanings: ${error.message}`);
  }
};

// Helper function to get kanji details from local JSON data
const getKanjiFromJSON = (kanjiMeanings, char) => {
  const entry = kanjiMeanings.find((entry) => entry.kanji === char);
  return entry ? { kanji: entry.kanji, meaning: entry.meaning } : null;
};

// Function to fetch kanji details, with fallback to JSON data
async function getKanjiDetails(char, kanjiMeanings) {
  // Assuming you have a config object available
  const showKanji = config.showKanji;

  if (!showKanji) {
    return null;
  }

  // Check if kanji meaning exists in JSON
  const localKanji = getKanjiFromJSON(kanjiMeanings, char);
  if (localKanji) {
    return localKanji; // Return both kanji and meaning
  }

  // If not found in JSON, fetch from API
  try {
    const response = await fetch(
      `https://kanjiapi.dev/v1/kanji/${encodeURIComponent(char)}`
    );
    return await response.json();
  } catch (error) {
    return null; // Handle error without logging
  }
}

// Example usage
const kanjiMeanings = await loadKanjiMeanings();

function isKanji(char) {
  return /\p{Script=Han}/u.test(char) && char !== "々";
}

function getClosestClientRect(elem, x, y) {
  const rects = elem.getClientRects();
  if (rects.length === 1) return rects[0];
  // Merge client rects that are adjacent
  // This works around a Chrome issue, where sometimes, non-deterministically,
  // inline child elements will get separate client rects, even if they are on the same line.
  const { writingMode } = getComputedStyle(elem);
  const horizontal = writingMode.startsWith("horizontal");
  const mergedRects = [];
  for (const rect of rects) {
    if (mergedRects.length === 0) {
      mergedRects.push(rect);
      continue;
    }
    const prevRect = mergedRects[mergedRects.length - 1];
    if (horizontal) {
      if (rect.bottom === prevRect.bottom && rect.left === prevRect.right) {
        mergedRects[mergedRects.length - 1] = new DOMRect(
          prevRect.x,
          prevRect.y,
          rect.right - prevRect.left,
          prevRect.height
        );
      } else {
        mergedRects.push(rect);
      }
    } else {
      if (rect.right === prevRect.right && rect.top === prevRect.bottom) {
        mergedRects[mergedRects.length - 1] = new DOMRect(
          prevRect.x,
          prevRect.y,
          prevRect.width,
          rect.bottom - prevRect.top
        );
      } else {
        mergedRects.push(rect);
      }
    }
  }
  // Debugging this was a nightmare, so I'm leaving this debug code here
  // console.log(rects);
  // console.log(mergedRects);
  // document.querySelectorAll('Rect').forEach(x => x.parentElement?.removeChild(x));
  // document.body.insertAdjacentHTML(
  //     'beforeend',
  //     mergedRects
  //         .map(
  //             (rect, i) =>
  //                 `<Rect style="position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;background-color:rgba(255,0,0,0.3);box-sizing:border-box;border:solid black 1px;pointer-events:none;">${i}</Rect>`,
  //         )
  //         .join(''),
  // );
  return mergedRects
    .map((rect) => ({
      rect,
      distance:
        Math.max(rect.left - x, 0, x - rect.right) ** 2 +
        Math.max(rect.top - y, 0, y - rect.bottom) ** 2,
    }))
    .reduce((a, b) => (a.distance <= b.distance ? a : b)).rect;
}
function renderPitch(reading, pitch) {
  if (reading.length != pitch.length - 1) {
    return jsxCreateElement("span", null, "Error: invalid pitch");
  }
  try {
    const parts = [];
    let lastBorder = 0;
    const borders = Array.from(
      pitch.matchAll(/L(?=H)|H(?=L)/g),
      (x) => nonNull(x.index) + 1
    );
    let low = pitch[0] === "L";
    for (const border of borders) {
      parts.push(
        jsxCreateElement(
          "span",
          { class: low ? "low" : "high" },
          reading.slice(lastBorder, border)
        )
      );
      lastBorder = border;
      low = !low;
    }
    if (lastBorder != reading.length) {
      // No switch after last part
      parts.push(
        jsxCreateElement(
          "span",
          { class: low ? "low-final" : "high-final" },
          reading.slice(lastBorder)
        )
      );
    }
    return jsxCreateElement("span", { class: "pitch" }, parts);
  } catch (error) {
    console.error(error);
    return jsxCreateElement("span", null, "Error: invalid pitch");
  }
}

class ImmersionKit {
  constructor(vocabSection) {
    this.examples = [];
    this.currentIndex = 0;
    this.isExpanded = false;
    this.lastWord = null;
    this.vocabSection = vocabSection;
    // Flag to indicate if the Play-All sequence is active
    this.isPlayingAll = false;
    // For audio playback via playAudio method
    this.currentAudio = null;
    this.currentRequest = null; // Track current API request
    this.currentWord = null; // Track current word being displayed
  }

  // Cancel any pending request
  cancelCurrentRequest() {
    if (this.currentRequest) {
      this.currentRequest.aborted = true;
      this.currentRequest = null;
    }
  }

  async tryFetch(word, useFullParams = false) {
    const baseUrl = `https://api.immersionkit.com/look_up_dictionary?keyword=${encodeURIComponent(
      word
    )}&sort=shortness`;
    const fullUrl = `${baseUrl}&tags=&jlpt=&wk=&decks=`;

    const response = await fetch(useFullParams ? fullUrl : baseUrl);
    const data = await response.json();

    if (data?.data?.[0]?.examples?.length > 0) {
      this.examples = data.data[0].examples;
      this.currentIndex = 0;
      return true;
    }

    return false;
  }

  async fetchExamples(word) {
    // Don't fetch if same word
    if (word === this.currentWord) return true;

    // Cancel any pending request
    this.cancelCurrentRequest();

    try {
      // Create new request state
      this.currentRequest = { aborted: false };
      const thisRequest = this.currentRequest;
      this.currentWord = word;

      // Try the full word first
      if (
        (await this.tryFetchWithAbort(word, false, thisRequest)) ||
        (await this.tryFetchWithAbort(word, true, thisRequest))
      ) {
        return !thisRequest.aborted;
      }

      // If no examples found, try with particles
      const particles = ["を", "に", "が", "へ", "と", "で"];
      for (const particle of particles) {
        if (word.includes(particle) && !thisRequest.aborted) {
          const [before, after] = word.split(particle);

          if (
            (before &&
              (await this.tryFetchWithAbort(before, false, thisRequest))) ||
            (await this.tryFetchWithAbort(before, true, thisRequest))
          ) {
            return !thisRequest.aborted;
          }

          if (
            (after &&
              (await this.tryFetchWithAbort(after, false, thisRequest))) ||
            (await this.tryFetchWithAbort(after, true, thisRequest))
          ) {
            return !thisRequest.aborted;
          }
        }
      }

      return false;
    } catch (error) {
      return false;
    } finally {
      // Clear request if it's still the current one
      if (this.currentRequest && !this.currentRequest.aborted) {
        this.currentRequest = null;
      }
    }
  }

  async tryFetchWithAbort(word, useFullParams, request) {
    if (request.aborted) return false;

    const baseUrl = `https://api.immersionkit.com/look_up_dictionary?keyword=${encodeURIComponent(
      word
    )}&sort=shortness`;
    const fullUrl = `${baseUrl}&tags=&jlpt=&wk=&decks=`;
    const url = useFullParams ? fullUrl : baseUrl;

    try {
      const response = await fetch(url);
      if (request.aborted) return false;

      const data = await response.json();
      if (request.aborted) return false;

      if (data?.data?.[0]?.examples?.length > 0) {
        this.examples = data.data[0].examples;
        this.currentIndex = 0;
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Updated navigate() method for cyclic navigation:
  // It wraps the current index using modular arithmetic.
  navigate(direction) {
    this.currentIndex =
      (this.currentIndex + direction + this.examples.length) %
      this.examples.length;
    this.updateDisplay();
    const example = this.examples[this.currentIndex];
    if (example?.sound_url) {
      this.playAudio(example.sound_url);
    }
  }

  // Existing audio playback method (manual play)
  async playAudio(url) {
    if (!url) return;

    // Stop any currently playing audio
    if (this.currentAudio) {
      this.currentAudio.stop();
      this.currentAudio = null;
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      this.currentAudio = audioContext.createBufferSource();
      this.currentAudio.buffer = audioBuffer;
      this.currentAudio.connect(audioContext.destination);
      this.currentAudio.start();

      // When audio ends, clear the currentAudio
      this.currentAudio.onended = () => {
        this.currentAudio = null;
      };
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  }

  // New helper method: plays audio and returns a promise that resolves when playback ends
  async playAudioPromise(url) {
    if (!url) return;
    if (this.currentAudio) {
      this.currentAudio.stop();
      this.currentAudio = null;
    }
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      return new Promise((resolve) => {
        this.currentAudio = audioContext.createBufferSource();
        this.currentAudio.buffer = audioBuffer;
        this.currentAudio.connect(audioContext.destination);
        this.currentAudio.start();
        this.currentAudio.onended = () => {
          this.currentAudio = null;
          resolve();
        };
      });
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  }

  // New method: plays all examples sequentially, pausing briefly between them.
  // If the container is removed from the DOM, the sequence stops.
  // After finishing, it resets to start from the first example.
  async playAllSequence() {
    if (this.isPlayingAll) return; // Prevent multiple simultaneous sequences
    this.isPlayingAll = true;
    // Loop from the current index to the end
    for (let i = this.currentIndex; i < this.examples.length; i++) {
      // Check if the immersion example container is still present in the DOM.
      const container = this.vocabSection.querySelector(".immersion-example");
      if (!container) {
        // If not, cancel the play-all sequence.
        this.isPlayingAll = false;
        break;
      }
      if (!this.isPlayingAll) break; // Allow external cancellation
      this.currentIndex = i;
      this.updateDisplay(); // Update UI to reflect the current example
      const example = this.examples[i];
      if (example.sound_url) {
        await this.playAudioPromise(example.sound_url);
      } else {
        // If no audio, wait 1 second
        await new Promise((res) => setTimeout(res, 1000));
      }
      // Brief pause between examples (e.g. 500ms)
      await new Promise((res) => setTimeout(res, 500));
    }
    // Reset to start from the first example when sequence finishes
    this.currentIndex = 0;
    this.isPlayingAll = false;
    this.updateDisplay();
  }

  // Display update method
  updateDisplay() {
    const example = this.examples[this.currentIndex];
    if (!example) return;

    const newExample = this.renderExample();
    if (!newExample) return;

    const container = this.vocabSection.querySelector(".immersion-example");
    if (container) {
      container.replaceWith(newExample);
    } else {
      this.vocabSection.appendChild(newExample);
    }
  }

  // Render method: existing buttons remain unchanged; a new "Play All" button is added in the same row as the navigation buttons.
  renderExample() {
    if (!this.examples.length) return null;

    const example = this.examples[this.currentIndex];
    if (!example) return null;

    return jsxCreateElement(
      "div",
      { class: "immersion-example" },
      jsxCreateElement(
        "div",
        { class: "example-content" },
        // Navigation row with Prev, Index, Next, and Play-All buttons
        jsxCreateElement(
          "div",
          {
            class: "example-nav",
            style: "display: flex; align-items: center; gap: 8px;",
          },
          jsxCreateElement(
            "button",
            {
              // Removed disabled attribute for cyclic navigation
              onclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.navigate(-1);
              },
            },
            "←"
          ),
          jsxCreateElement(
            "span",
            null,
            `${this.currentIndex + 1}/${this.examples.length}`
          ),
          jsxCreateElement(
            "button",
            {
              // Removed disabled attribute for cyclic navigation
              onclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.navigate(1);
              },
            },
            "→"
          ),
          // Play All button as an icon, aligned to the right
          jsxCreateElement(
            "button",
            {
              class: "play-all-button",
              style:
                "margin-left: auto; padding: 4px 8px; font-size: 16px; cursor: pointer;",
              onclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Toggle Play-All: if already playing, cancel; otherwise, start the sequence.
                if (this.isPlayingAll) {
                  this.isPlayingAll = false;
                } else {
                  this.playAllSequence();
                }
              },
            },
            this.isPlayingAll ? "⏹️" : "▶️"
          )
        ),
        // Image and Audio Button Container with fixed dimensions
        jsxCreateElement(
          "div",
          {
            class: "image-audio-container",
            style:
              "min-height: 200px; width: 100%; background: #222; display: flex; align-items: center; justify-content: center; position: relative;",
          },
          // Image
          example.image_url &&
            jsxCreateElement("img", {
              src: example.image_url,
              alt: "Example image",
              class: "example-image",
              style: "max-width: 100%; max-height: 200px; display: block;",
              onclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.playAudio(example.sound_url);
              },
            }),
          // Audio Button
          jsxCreateElement(
            "button",
            {
              class: "audio-button",
              style:
                "position: absolute; bottom: 8px; right: 8px; padding: 4px;",
              onclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.playAudio(example.sound_url);
              },
            },
            "🔊"
          )
        ),
        // Japanese sentence
        jsxCreateElement(
          "div",
          { class: "example-sentence" },
          example.sentence
        ),
        // English translation
        jsxCreateElement(
          "div",
          { class: "example-translation" },
          example.translation
        )
      )
    );
  }
}

// ── JPDB Pronunciation Audio ──
// XOR key for decrypting JPDB audio files.
const JPDB_XOR_KEY = [0x06, 0x23, 0x54, 0x0f];
let _jpdbCurrentAudio = null;

const JpdbAudio = {
  _cache: {},

  async speak(vid, spelling) {
    if (_jpdbCurrentAudio) {
      try { _jpdbCurrentAudio.pause(); } catch {}
      _jpdbCurrentAudio = null;
    }
    if (!vid) return;
    const hash = this._cache[vid] ?? await this._scrapeHash(vid, spelling);
    if (hash) await this._play(hash);
  },

  async _scrapeHash(vid, spelling) {
    try {
      const result = await requestFetchAudioHash(vid, spelling);
      if (result?.hash) { this._cache[vid] = result.hash; return result.hash; }
    } catch {}
    return null;
  },

  async _play(hash) {
    try {
      const result = await requestFetchAudioBytes(hash);
      if (!result?.bytes) return;
      const buf = new Uint8Array(result.bytes);
      for (let i = 0; i < Math.min(4, buf.length); i++) buf[i] ^= JPDB_XOR_KEY[i];
      const blobUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/ogg' }));
      const audio = new Audio(blobUrl);
      _jpdbCurrentAudio = audio;
      audio.onended = () => { URL.revokeObjectURL(blobUrl); _jpdbCurrentAudio = null; };
      audio.onerror = () => { URL.revokeObjectURL(blobUrl); _jpdbCurrentAudio = null; };
      audio.play().catch(() => URL.revokeObjectURL(blobUrl));
    } catch {}
  },
};

export class Popup {
  #demoMode;
  #element;
  #customStyle;
  #outerStyle;
  #vocabSection;
  #mineButtons;
  #data;
  static #popup;
  static get() {
    if (!this.#popup) {
      this.#popup = new this();
      document.body.append(this.#popup.#element);
    }
    return this.#popup;
  }
  static getDemoMode(parent) {
    const popup = new this(true);
    parent.append(popup.#element);
    return popup;
  }
  constructor(demoMode = false) {
    this.#demoMode = demoMode;
    this.#element = jsxCreateElement("div", {
      id: "jpdb-popup",
      onmousedown: (event) => {
        event.stopPropagation();
      },
      onclick: (event) => {
        event.stopPropagation();
      },
      onwheel: (event) => {
        event.stopPropagation();
      },
      ontouchstart: (event) => {
        // Don't prevent default here to allow scrolling inside popup
        event.stopPropagation();
      },
      ontouchmove: (event) => {
        // Check if we're scrolling inside the popup
        let target = event.target;
        let scrollableParentFound = false;

        // Look for scrollable parent elements
        while (target && target !== this.#element) {
          const style = window.getComputedStyle(target);
          const isScrollable =
            (target.scrollHeight > target.clientHeight &&
              (style.overflowY === "auto" || style.overflowY === "scroll")) ||
            (target.scrollWidth > target.clientWidth &&
              (style.overflowX === "auto" || style.overflowX === "scroll"));

          if (isScrollable) {
            scrollableParentFound = true;
            break;
          }
          target = target.parentElement;
        }

        // If we're inside the popup, allow scrolling
        if (target && (target === this.#element || scrollableParentFound)) {
          event.stopPropagation();
          return;
        }

        // Prevent background page scroll
        event.preventDefault();
        event.stopPropagation();
      },
      ontouchend: (event) => {
        event.stopPropagation();
      },
      style: `all:initial;z-index:2147483647;${
        demoMode
          ? ""
          : "position:absolute;top:0;left:0;opacity:0;visibility:hidden;"
      };`,
    });
    const shadow = this.#element.attachShadow({ mode: "closed" });
    shadow.append(
      jsxCreateElement("link", {
        rel: "stylesheet",
        href: browser.runtime.getURL("/themes.css"),
      }),
      jsxCreateElement("link", {
        rel: "stylesheet",
        href: browser.runtime.getURL("/content/popup.css"),
      }),
      (this.#customStyle = jsxCreateElement("style", null)),
      jsxCreateElement(
        "article",
        { lang: "ja" },
        (this.#mineButtons = jsxCreateElement("section", {
          id: "mine-buttons",
        })),
        jsxCreateElement(
          "section",
          { id: "review-buttons" },
          // SRS review buttons
          jsxCreateElement(
            "button",
            {
              class: "nothing",
              onclick: demoMode ? undefined : async () => await requestReview(this.#data.token.card, "nothing"),
            },
            "Nothing"
          ),
          jsxCreateElement(
            "button",
            {
              class: "something",
              onclick: demoMode ? undefined : async () => await requestReview(this.#data.token.card, "something"),
            },
            "Something"
          ),
          jsxCreateElement(
            "button",
            {
              class: "hard",
              onclick: demoMode ? undefined : async () => await requestReview(this.#data.token.card, "hard"),
            },
            "Hard"
          ),
          jsxCreateElement(
            "button",
            {
              class: "good",
              onclick: demoMode ? undefined : async () => await requestReview(this.#data.token.card, "good"),
            },
            "Good"
          ),
          jsxCreateElement(
            "button",
            {
              class: "easy",
              onclick: demoMode ? undefined : async () => await requestReview(this.#data.token.card, "easy"),
            },
            "Easy"
          )
        ),
        (this.#vocabSection = jsxCreateElement("section", {
          id: "vocab-content",
        }))
      )
    );
    this.#outerStyle = this.#element.style;
    this.immersionKit = new ImmersionKit(this.#vocabSection);
  }

  // Add debouncer property
  #pendingExampleLoad = null;

  async toggleImmersionKit() {
    const currentWord = this.#data.token.card.spelling;

    // Remove all existing example sections first
    const existingExamples =
      this.#vocabSection.querySelectorAll(".immersion-example");
    existingExamples.forEach((example) => example.remove());

    // Cancel any pending audio
    if (this.immersionKit.currentAudio) {
      this.immersionKit.currentAudio.stop();
      this.immersionKit.currentAudio = null;
    }

    // Reset play-all state
    this.immersionKit.isPlayingAll = false;

    // Check if we need to fetch new examples
    if (this.immersionKit.lastWord !== currentWord) {
      // Clear old examples and fetch new ones
      this.immersionKit.examples = [];
      this.immersionKit.currentIndex = 0;
      const success = await this.immersionKit.fetchExamples(currentWord);
      if (!success) return;

      // Create new example section
      const example = this.immersionKit.renderExample();
      if (example) {
        this.#vocabSection.appendChild(example);
        await this.immersionKit.playAudio(
          this.immersionKit.examples[0].sound_url
        );
      }
    } else {
      // Re-render existing examples if we're toggling visibility
      const example = this.immersionKit.renderExample();
      if (example) {
        this.#vocabSection.appendChild(example);
      }
    }

    this.immersionKit.isExpanded = true;
  }

  fadeIn() {
    // Necessary because in settings page, config is undefined
    // TODO is this still true? ~hmry(2023-08-08)
    if (config && !config.disableFadeAnimation) {
      this.#outerStyle.transition = "opacity 60ms ease-in, visibility 60ms";
    }
    this.#outerStyle.opacity = "1";
    this.#outerStyle.visibility = "visible";
  }
  fadeOut() {
    // Necessary because in settings page, config is undefined
    // TODO is this still true? ~hmry(2023-08-08)
    if (config && !config.disableFadeAnimation) {
      this.#outerStyle.transition = "opacity 200ms ease-in, visibility 200ms";
    }
    this.#outerStyle.opacity = "0";
    this.#outerStyle.visibility = "hidden";
  }
  disablePointer() {
    this.#outerStyle.pointerEvents = "none";
    this.#outerStyle.userSelect = "none";
  }
  enablePointer() {
    this.#outerStyle.pointerEvents = "";
    this.#outerStyle.userSelect = "";
  }
  async render() {
    if (this.#data === undefined) return;
    const card = this.#data.token.card;
    const url = `https://jpdb.io/vocabulary/${card.vid}/${encodeURIComponent(
      card.spelling
    )}/${encodeURIComponent(card.reading)}`;
    const kanjiUrl = (kanji) =>
      `https://jpdb.io/kanji/${encodeURIComponent(kanji)}`;

    // Get character details with local JSON check
    let characterDetails = (
      await Promise.all(
        [...card.spelling].filter(isKanji).map(async (char) => {
          const charDetails = await getKanjiDetails(char, kanjiMeanings);
          return charDetails
            ? {
                kanji: charDetails.kanji,
                meanings:
                  charDetails.meaning || charDetails.meanings.join(", "),
              }
            : null;
        })
      )
    ).filter(Boolean);

    characterDetails = characterDetails.length ? characterDetails : null;

    let hindiMeaning = null;
    if (config.showHindi) {
      if (!dictionaryLoaded) {
        await loadDictionary();
      }
      hindiMeaning = dictionary.search(this.#data.token.card.spelling);
    }

    const MEANINGS_PER_SET = 3;

    const createMeaningChunks = (meanings, chunkSize = MEANINGS_PER_SET) => {
      // Filter out non-string values and empty strings
      const validMeanings = meanings.filter(
        (meaning) => typeof meaning === "string" && meaning.trim().length > 0
      );

      return validMeanings.reduce((chunks, meaning, index) => {
        const chunkIndex = Math.floor(index / chunkSize);
        if (!chunks[chunkIndex]) chunks[chunkIndex] = [];
        chunks[chunkIndex].push(meaning);
        return chunks;
      }, []);
    };

    const renderHindiMeanings = (meanings) => {
      if (!meanings?.length) return "";

      const uniqueMeanings = [...new Set(meanings)].filter(
        (meaning) => typeof meaning === "string" && meaning.trim().length > 0
      );

      const meaningChunks = createMeaningChunks(uniqueMeanings);

      if (!meaningChunks.length) return "";

      const hasMoreMeanings = meaningChunks.length > 1;

      return jsxCreateElement(
        "div",
        { class: "hindi-meanings" },
        jsxCreateElement("h2", null, "Hindi Meaning"),
        jsxCreateElement(
          "div",
          { class: "meaning-list" },
          [
            jsxCreateElement("div", { class: "meaning-set" }, [
              jsxCreateElement("span", { class: "set-number" }, "1. "),
              jsxCreateElement(
                "span",
                { class: "primary-meanings" },
                meaningChunks[0].join("; ")
              ),
              ...(hasMoreMeanings
                ? [
                    jsxCreateElement(
                      "button",
                      {
                        class: "toggle-more",
                        onclick: (e) => {
                          const container = e.target.closest(".hindi-meanings");
                          const moreMeanings =
                            container.querySelector(".more-meanings");
                          const isExpanded =
                            moreMeanings.classList.toggle("expanded");
                          e.target.textContent = isExpanded ? "▼" : "▶";
                        },
                      },
                      "▶"
                    ),
                  ]
                : []),
            ]),
            hasMoreMeanings &&
              jsxCreateElement(
                "div",
                { class: "more-meanings" },
                meaningChunks
                  .slice(1)
                  .map((chunk, index) =>
                    jsxCreateElement("div", { class: "meaning-set" }, [
                      jsxCreateElement(
                        "span",
                        { class: "set-number" },
                        `${index + 2}. `
                      ),
                      chunk.join("; "),
                    ])
                  )
              ),
          ].filter(Boolean)
        )
      );
    };

    // Group meanings by part of speech
    const groupedMeanings = [];
    let lastPOS = [];
    for (const [index, meaning] of card.meanings.entries()) {
      if (
        // Same part of speech as previous meaning?
        meaning.partOfSpeech.length == lastPOS.length &&
        meaning.partOfSpeech.every((p, i) => p === lastPOS[i])
      ) {
        // Append to previous meaning group
        groupedMeanings[groupedMeanings.length - 1].glosses.push(
          meaning.glosses
        );
      } else {
        // Create a new meaning group
        groupedMeanings.push({
          partOfSpeech: meaning.partOfSpeech,
          glosses: [meaning.glosses],
          startIndex: index,
        });
        lastPOS = meaning.partOfSpeech;
      }
    }
    this.#vocabSection.replaceChildren(
      jsxCreateElement(
        "div",
        { id: "header" },
        jsxCreateElement(
          "div",
          { class: "header-main-info" },
          jsxCreateElement(
            "a",
            { lang: "ja", href: url, target: "_blank", class: "word-link" },
            jsxCreateElement("span", { class: "spelling" }, card.spelling),
            jsxCreateElement(
              "span",
              { class: "reading" },
              card.spelling !== card.reading ? `(${card.reading})` : ""
            )
          ),
          jsxCreateElement(
            "div",
            { class: "utility-icons" },
            jsxCreateElement(
              "button",
              {
                class: "util-btn audio-btn",
                title: "Play pronunciation",
                onclick: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  JpdbAudio.speak(card.vid, card.spelling);
                },
              },
              "🔊"
            ),
            jsxCreateElement(
              "button",
              {
                class: "util-btn",
                title: "Explain word",
                onclick: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  this.explainWord(card.spelling, card.meanings);
                },
              },
              "ℹ️"
            )
          )
        ),
        jsxCreateElement(
          "div",
          { class: "state" },
          card.state.map((s) => jsxCreateElement("span", { class: s }, s))
        )
      ),
      jsxCreateElement(
        "div",
        { class: "metainfo" },
        jsxCreateElement(
          "span",
          { class: "freq" },
          card.frequencyRank ? `Top ${card.frequencyRank}` : ""
        ),
        card.pitchAccent.map((pitch) => renderPitch(card.reading, pitch))
      ),
      characterDetails
        ? jsxCreateElement(
            "div",
            { class: "kanji-meanings" },
            characterDetails
              .filter((details) => details && details.meanings)
              .map((details) => {
                if (!details || !details.kanji) return null;

                return jsxCreateElement(
                  "div",
                  {
                    class: "kanji-item",
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    },
                  },
                  // Link for kanji
                  jsxCreateElement(
                    "a",
                    {
                      lang: "ja",
                      href: kanjiUrl(details.kanji),
                      target: "_blank",
                      style: {
                        textDecoration: "none",
                        color: "inherit",
                        cursor: "pointer",
                        display: details.kanji ? "inline" : "none",
                        userSelect: "none", // for touch devices
                      },
                    },
                    jsxCreateElement("span", {}, `${details.kanji}:`)
                  ),
                  jsxCreateElement("span", {}, " \u00A0"),
                  // Link for meanings
                  jsxCreateElement(
                    "a",
                    {
                      href: `https://kanji.koohii.com/study/kanji/${details.kanji}`,
                      target: "_blank",
                      style: {
                        textDecoration: "none",
                        color: "inherit",
                        cursor: "pointer",
                        display: details.meanings ? "inline" : "none",
                        userSelect: "none", // for touch devices
                      },
                    },
                    jsxCreateElement(
                      "span",
                      { class: "reading" },
                      details.meanings
                    )
                  )
                );
              })
          )
        : "",
      hindiMeaning?.meaning?.length
        ? renderHindiMeanings(hindiMeaning.meaning)
        : "",
      ...groupedMeanings.flatMap((meanings) => [
        jsxCreateElement(
          "h2",
          null,
          meanings.partOfSpeech
            .map(
              (pos) =>
                PARTS_OF_SPEECH[pos] ??
                `(Unknown part of speech #${pos}, please report)`
            )
            .filter((x) => x.length > 0)
            .join(", ")
        ),
        jsxCreateElement(
          "ol",
          { start: meanings.startIndex + 1 },
          meanings.glosses.map((glosses) =>
            jsxCreateElement("li", null, glosses.join("; "))
          )
        ),
      ])
    );
    const blacklisted = card.state.includes("blacklisted");
    const neverForget = card.state.includes("never-forget");
    this.#mineButtons.replaceChildren(
      jsxCreateElement(
        "button",
        {
          class: "add",
          onclick: this.#demoMode
            ? undefined
            : () =>
                requestMine(
                  this.#data.token.card,
                  config.forqOnMine,
                  getSentences(this.#data, config.contextWidth).trim() ||
                    undefined,
                  undefined
                ),
        },
        "Add"
      ),
      jsxCreateElement(
        "button",
        {
          class: "edit-add-review",
          onclick: this.#demoMode
            ? undefined
            : () => Dialog.get().showForWord(this.#data),
        },
        "Edit, Add and Review..."
      ),
      jsxCreateElement(
        "button",
        {
          class: "blacklist",
          onclick: this.#demoMode
            ? undefined
            : async () =>
                await requestSetFlag(
                  this.#data.token.card,
                  "blacklist",
                  !blacklisted
                ),
        },
        !blacklisted ? "Blacklist" : "Remove from blacklist"
      ),
      jsxCreateElement(
        "button",
        {
          class: "never-forget",
          onclick: this.#demoMode
            ? undefined
            : async () =>
                await requestSetFlag(
                  this.#data.token.card,
                  "never-forget",
                  !neverForget
                ),
        },
        !neverForget ? "Never forget" : "Unmark as never forget"
      )
    );
  }
  setData(data) {
    this.#data = data;
    this.render();
  }
  containsMouse(event) {
    const targetElement = event.target;
    if (targetElement) {
      return this.#element.contains(targetElement);
    }
    return false;
  }
  async showExamplesAutomatically() {
    // Cancel any pending loads
    if (this.#pendingExampleLoad) {
      clearTimeout(this.#pendingExampleLoad);
    }

    // Cancel any pending requests
    if (this.immersionKit) {
      this.immersionKit.cancelCurrentRequest();
    }

    if (config.showExamplesAutomatically) {
      // Debounce the example loading by 300ms
      this.#pendingExampleLoad = setTimeout(async () => {
        // Remove any existing examples before loading new ones
        const existingExamples =
          this.#vocabSection.querySelectorAll(".immersion-example");
        existingExamples.forEach((example) => example.remove());

        await this.toggleImmersionKit();
      }, 300);
    }
  }

  showForWord(word, mouseX = 0, mouseY = 0) {
    const data = word.jpdbData;
    this.setData(data); // Because we need the dimensions of the popup with the new data
    const bbox = getClosestClientRect(word, mouseX, mouseY);
    const wordLeft = window.scrollX + bbox.left;
    const wordTop = window.scrollY + bbox.top;
    const wordRight = window.scrollX + bbox.right;
    const wordBottom = window.scrollY + bbox.bottom;
    // window.innerWidth/Height technically contains the scrollbar, so it's not 100% accurate
    // Good enough for this though
    const leftSpace = bbox.left;
    const topSpace = bbox.top;
    const rightSpace = window.innerWidth - bbox.right;
    const bottomSpace = window.innerHeight - bbox.bottom;
    const popupHeight = this.#element.offsetHeight;
    const popupWidth = this.#element.offsetWidth;
    const minLeft = window.scrollX;
    const maxLeft = window.scrollX + window.innerWidth - popupWidth;
    const minTop = window.scrollY;
    const maxTop = window.scrollY + window.innerHeight - popupHeight;
    let popupLeft;
    let popupTop;
    const { writingMode } = getComputedStyle(word);
    if (writingMode.startsWith("horizontal")) {
      popupTop = clamp(
        bottomSpace > topSpace ? wordBottom : wordTop - popupHeight,
        minTop,
        maxTop
      );
      popupLeft = clamp(
        rightSpace > leftSpace ? wordLeft : wordRight - popupWidth,
        minLeft,
        maxLeft
      );
    } else {
      popupTop = clamp(
        bottomSpace > topSpace ? wordTop : wordBottom - popupHeight,
        minTop,
        maxTop
      );
      popupLeft = clamp(
        rightSpace > leftSpace ? wordRight : wordLeft - popupWidth,
        minLeft,
        maxLeft
      );
    }
    this.#outerStyle.transform = `translate(${popupLeft}px,${popupTop}px)`;
    this.fadeIn();
    this.showExamplesAutomatically();
  }
  updateStyle(newCSS = config.customPopupCSS) {
    this.#customStyle.textContent = newCSS;
  }

  async explainWord(word, meanings) {
    if (!config.geminiApiKey) {
      alert("Please set your Gemini API key in the extension settings first.");
      return;
    }

    if (!window.explanationPopup) {
      window.explanationPopup = new ExplanationPopup();
      document.body.append(window.explanationPopup.element);
    }

    // Show loading state
    window.explanationPopup.showLoading();

    const definition = meanings
      .map((meaning) => meaning.glosses.join("; "))
      .join("; ");
    const prompt = `You are an expert teacher and communicator. Explain why the Japanese word ${word} is defined as "${definition}" so a complete beginner can genuinely understand it, not just read it.

Provide an etymological breakdown of its individual kanji components and how these meanings logically combine to form the overall definition.

Write in natural flowing, deeply engaging, and *visually scannable* paragraphs. Keep the tone conversational, clear, and thoughtful. Break up the formatting cleanly with bullet points, bold emphasis, and short paragraphs so it isn't an exhausting wall of text. Never sound robotic or academic.

Apply these principles naturally where they fit:
- Start from the most basic truth and build upward.
- Break the idea into small logical parts.
- Connect unfamiliar ideas to familiar ones (analogies) or link to what a beginner likely knows.
- Make the main point clear early, then support it.
- Keep it simple without losing accuracy.
- Never use technical linguistic jargon without immediately explaining it in plain language.
- Make each idea flow naturally into the next.
- Prioritize clarity and understanding over sounding impressive.

End with one short sentence that captures the core meaning plainly.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${config.geminiApiKey}`,
        {
          method: "POST",
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const explanation = data.candidates[0].content.parts[0].text;
      window.explanationPopup.show(explanation);
    } catch (error) {
      console.error("Error fetching explanation:", error);
      alert(
        "Failed to get explanation. Please check your API key and try again."
      );
      window.explanationPopup.hide();
    }
  }
}

class ExplanationPopup {
  constructor() {
    this.element = jsxCreateElement("div", {
      id: "jpdb-explanation-popup",
      style: `all:initial; z-index:2147483647; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; opacity:0; visibility:hidden; transition:opacity 0.2s ease, visibility 0.2s ease; overscroll-behavior:none;`,
    });
    
    // Close modal when clicking the dark backdrop
    this.element.addEventListener("click", (e) => {
      if (e.target === this.element) this.hide();
    });
    const shadow = this.element.attachShadow({ mode: "closed" });

    // Add loading spinner and popup styles
    const styles = jsxCreateElement(
      "style",
      null,
      `
      article::-webkit-scrollbar {
        width: 8px;
      }
      article::-webkit-scrollbar-track {
        background: transparent;
      }
      article::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 10px;
      }
      article::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .loader {
        width: 48px;
        height: 48px;
        border: 5px solid #FFF;
        border-bottom-color: transparent;
        border-radius: 50%;
        display: inline-block;
        box-sizing: border-box;
        animation: rotation 1s linear infinite;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      @keyframes rotation {
        0% { transform: translate(-50%, -50%) rotate(0deg); }
        100% { transform: translate(-50%, -50%) rotate(360deg); }
      }

      .loading {
        min-height: 200px;
        position: relative;
      }

      .explanation-content {
        font-family: inherit;
        line-height: 1.6;
        padding: 1.5em;
        background: var(--color-background);
        color: var(--color-text);
        text-align: left;
        font-size: 1.05em;
      }
      
      .explanation-content h1, 
      .explanation-content h2, 
      .explanation-content h3, 
      .explanation-content h4 {
        margin: 1.2em 0 0.5em 0;
        color: var(--color-text);
        line-height: 1.3;
      }
      
      .explanation-content h3 { 
        font-size: 1.25em; 
        border-bottom: 1px solid rgba(135, 206, 250, 0.3); 
        padding-bottom: 0.3em; 
      }
      
      .explanation-content h4 { 
        font-size: 1.1em; 
        color: lightskyblue; 
      }
      
      .explanation-content p {
        margin: 0 0 1.3em 0;
      }
      
      .explanation-content hr {
        border: none;
        border-top: 1px dashed rgba(255, 255, 255, 0.2);
        margin: 1.5em 0;
      }
      
      .explanation-content ul, .explanation-content ol {
        margin: 0.5em 0 1em 1.5em;
        padding: 0;
      }
      
      .explanation-content li { 
        margin-bottom: 0.4em; 
      }
      
      .explanation-content strong { 
        font-weight: 600; 
        color: lightskyblue; 
      }
      
      .explanation-content em {
        color: #A9A9A9;
      }
    `
    );

    const modalArticle = jsxCreateElement(
      "article",
      {
        style: `width: 90vw; max-width: 650px; height: auto; max-height: 85vh; overflow-y: auto; background: var(--color-background); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; box-shadow: 0 15px 50px rgba(0,0,0,0.6); overscroll-behavior: contain; position: relative;`,
      },
      (this.content = jsxCreateElement("div", {
        class: "explanation-content",
      }))
    );

    shadow.append(
      jsxCreateElement("link", {
        rel: "stylesheet",
        href: browser.runtime.getURL("/themes.css"),
      }),
      jsxCreateElement("link", {
        rel: "stylesheet",
        href: browser.runtime.getURL("/content/popup.css"),
      }),
      styles,
      modalArticle
    );

    // Stop events from escaping the overlay
    this.element.addEventListener("wheel", (e) => {
      e.stopPropagation();
      if (e.target === this.element) e.preventDefault();
    }, { passive: false });

    this.element.addEventListener("touchmove", (e) => {
      e.stopPropagation();
      if (e.target === this.element) e.preventDefault();
    }, { passive: false });

    // Explicit scroll locking for the article to stop manual scroll chaining
    modalArticle.addEventListener("wheel", (e) => {
      e.stopPropagation();
      const el = e.currentTarget;
      const isUp = e.deltaY < 0;
      const isDown = e.deltaY > 0;
      const isAtTop = el.scrollTop <= 0;
      const isAtBottom = el.scrollHeight - Math.ceil(el.scrollTop) <= el.clientHeight;

      if ((isUp && isAtTop) || (isDown && isAtBottom)) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  showLoading() {
    this.content.replaceChildren(
      jsxCreateElement(
        "div",
        { class: "loading" },
        jsxCreateElement("span", { class: "loader" })
      )
    );
    this.element.style.opacity = "1";
    this.element.style.visibility = "visible";
  }

  formatExplanation(text) {
    let parsed = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^#{4}\s+(.*)$/gm, '<h4>$1</h4>')
      .replace(/^#{3}\s+(.*)$/gm, '<h3>$1</h3>')
      .replace(/^#{2}\s+(.*)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
      .replace(/^---$/gm, '<hr>');

    const blocks = parsed.split(/\n\s*\n/);
    let htmlBlocks = blocks.map(block => {
      block = block.trim();
      if (!block) return '';
      
      // Pass through structures we explicitly created
      if (block.startsWith('<h') || block.startsWith('<hr')) return block;
      
      // Unordered Lists
      if (block.match(/^[\-\*]\s+/)) {
          return "<ul>" + block.split('\n').filter(l => l.trim()).map(l => `<li>${l.replace(/^[\-\*]\s+/, '')}</li>`).join('') + "</ul>";
      }
      
      // Ordered lists
      if (block.match(/^\d+\.\s+/)) {
          return "<ol>" + block.split('\n').filter(l => l.trim()).map(l => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('') + "</ol>";
      }
      
      // Standard paragraph. Preserve internal single line breaks.
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    });

    return htmlBlocks.join('\n');
  }

  show(explanation) {
    this.content.innerHTML = this.formatExplanation(explanation);
    this.element.style.opacity = "1";
    this.element.style.visibility = "visible";
  }

  hide() {
    this.element.style.opacity = "0";
    this.element.style.visibility = "hidden";
  }
}

document.addEventListener("click", (event) => {
  const explanationPopup = document.getElementById("jpdb-explanation-popup");
  const parentPopup = document.getElementById("jpdb-popup");

  if (event.target === parentPopup) {
    window.explanationPopup.hide();
    return;
  }

  if (explanationPopup && !explanationPopup.contains(event.target)) {
    window.explanationPopup.hide();
  }
});
