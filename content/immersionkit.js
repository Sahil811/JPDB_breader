import { jsxCreateElement } from '../jsx.js';

export class ImmersionKit {
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
    this.lastPlayId = 0;
    this.isLoopingAudio = false;
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
    // Cancel any pending request
    this.cancelCurrentRequest();

    try {
      this.currentRequest = { aborted: false };
      const thisRequest = this.currentRequest;
      this.currentWord = word;

      if (
        (await this.tryFetchWithAbort(word, false, thisRequest)) ||
        (await this.tryFetchWithAbort(word, true, thisRequest))
      ) {
        return !thisRequest.aborted;
      }

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
      if (this.currentRequest && !this.currentRequest.aborted) {
        this.currentRequest = null;
      }
    }
  }

  async _ensureMetadata() {
    if (this.deckTitleMap) return;
    try {
      const response = await fetch("https://apiv2.immersionkit.com/index_meta");
      const json = await response.json();
      this.deckTitleMap = json.data || {};
    } catch (e) {
      this.deckTitleMap = {};
    }
  }

  async tryFetchWithAbort(word, useFullParams, request) {
    if (request.aborted) return false;

    // v2 API ignores useFullParams legacy flags
    const url = `https://apiv2.immersionkit.com/search?q=${encodeURIComponent(word)}&exactMatch=false&limit=50&sort=sentence_length:asc`;

    try {
      await this._ensureMetadata();
      const response = await fetch(url);
      if (request.aborted) return false;

      const data = await response.json();
      if (request.aborted) return false;

      const rawExamples = data.examples || [];
      const count = rawExamples.length;

      if (count > 0) {
        const linodeBaseUrl = 'https://us-southeast-1.linodeobjects.com/immersionkit/media/';
        this.examples = rawExamples.map(ex => {
            const slug = ex.title || '';
            const prettyTitle = this.deckTitleMap?.[slug]?.title || slug;
            const mediaType = ex.id ? ex.id.split('_')[0] : '';
            const fullImageUrl = ex.image && mediaType && prettyTitle ? `${linodeBaseUrl}${mediaType}/${prettyTitle}/media/${ex.image}` : '';
            const fullSoundUrl = ex.sound && mediaType && prettyTitle ? `${linodeBaseUrl}${mediaType}/${prettyTitle}/media/${ex.sound}` : '';
            return {
              ...ex,
              image_url: fullImageUrl,
              sound_url: fullSoundUrl
            };
        });
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

  // Shared helper: fetch + decode audio from a URL, return a BufferSource
  async _createBufferSource(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    return source;
  }

  // Stop currently playing audio
  _stopCurrent() {
    if (this.currentAudio) {
      try { this.currentAudio.stop(); } catch {}
      this.currentAudio = null;
    }
  }

  // Play audio (fire-and-forget)
  async playAudio(url) {
    if (!url) return;
    const playId = ++this.lastPlayId;
    this._stopCurrent();
    try {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      const source = await this._createBufferSource(url);
      if (playId !== this.lastPlayId) return; // Prevent overlapping audio on rapid clicks
      
      this.currentAudio = source;
      source.onended = () => { 
        if (this.currentAudio === source) this.currentAudio = null;
        if (this.isLoopingAudio) {
           setTimeout(() => {
             if (this.isLoopingAudio && playId === this.lastPlayId) {
                this.playAudio(url);
             }
           }, 150);
        }
      };
      source.start();
    } catch (err) {}
  }

  // Play audio and wait for it to finish (used by playAllSequence)
  async playAudioPromise(url) {
    if (!url) return;
    const playId = ++this.lastPlayId;
    this._stopCurrent();
    try {
      const source = await this._createBufferSource(url);
      if (playId !== this.lastPlayId) return;
      return new Promise((resolve) => {
        this.currentAudio = source;
        source.onended = () => { 
          if (this.currentAudio === source) this.currentAudio = null;
          resolve(); 
        };
        source.start();
      });
    } catch (err) {
      return Promise.resolve(); // Continue sequence on error
    }
  }

  // New method: Toggle Loop mode
  toggleLoop() {
    this.isLoopingAudio = !this.isLoopingAudio;
    if (this.isLoopingAudio) {
      this.isPlayingAll = false; // Disable play all
      const example = this.examples[this.currentIndex];
      if (example?.sound_url) {
        this.playAudio(example.sound_url);
      }
    } else {
      this._stopCurrent();
    }
    this.updateDisplay();
  }

  // New method: plays all examples sequentially, pausing briefly between them.
  async playAllSequence() {
    if (!this.examples.length) return;
    this.isPlayingAll = true;
    this.isLoopingAudio = false; // Disable single loop
    this.updateDisplay();

    while (this.isPlayingAll) {
      const example = this.examples[this.currentIndex];
      if (example?.sound_url) {
        // Wait for audio
        await this.playAudioPromise(example.sound_url);
      } else {
        // If no audio, wait 1 second
        await new Promise((res) => setTimeout(res, 1000));
      }
      // Brief pause between examples (e.g. 500ms)
      await new Promise((res) => setTimeout(res, 400));
      
      if (!this.isPlayingAll) break;

      this.currentIndex++;
      if (this.currentIndex >= this.examples.length) {
        this.currentIndex = 0;
        this.isPlayingAll = false;
        break;
      }
      this.updateDisplay();
    }
    
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
        // Navigation row with Prev, Index, Next, Loop, and Play-All buttons
        jsxCreateElement(
          "div",
          {
            class: "example-nav",
            style: "display: flex; align-items: center; gap: 8px; margin-bottom: 8px;",
          },
          jsxCreateElement(
            "button",
            {
              class: "ik-btn",
              onclick: (e) => { e.preventDefault(); e.stopPropagation(); this.navigate(-1); },
            },
            "←"
          ),
          jsxCreateElement(
            "span",
            { class: "example-counter" },
            `${this.currentIndex + 1}/${this.examples.length}`
          ),
          jsxCreateElement(
            "button",
            {
              class: "ik-btn",
              onclick: (e) => { e.preventDefault(); e.stopPropagation(); this.navigate(1); },
            },
            "→"
          ),
          jsxCreateElement(
            "button",
            {
              class: `ik-btn ${this.isLoopingAudio ? "is-active" : ""}`,
              style: "margin-left: auto; cursor: pointer;",
              title: "Loop current audio",
              onclick: (e) => { e.preventDefault(); e.stopPropagation(); this.toggleLoop(); },
            },
            "🔁"
          ),
          jsxCreateElement(
            "button",
            {
              class: `ik-btn ${this.isPlayingAll ? "is-active" : ""}`,
              style: "cursor: pointer;",
              title: "Play all examples",
              onclick: (e) => { e.preventDefault(); e.stopPropagation(); this.isPlayingAll ? (this.isPlayingAll = false) : this.playAllSequence(); },
            },
            this.isPlayingAll ? "⏹️" : "▶️"
          )
        ),
        // Image Container
        jsxCreateElement(
          "div",
          { class: "image-container" },
          example.image_url &&
            jsxCreateElement("img", {
              src: example.image_url,
              alt: "Example image",
              class: "example-image",
              onclick: (e) => { e.preventDefault(); e.stopPropagation(); this.playAudio(example.sound_url); },
            }),
          jsxCreateElement("div", { class: "image-gradient-overlay" }),
          jsxCreateElement(
            "button",
            {
              class: "ik-btn-overlay",
              onclick: (e) => { e.preventDefault(); e.stopPropagation(); this.playAudio(example.sound_url); },
            },
            "🔊"
          )
        ),
        // Japanese sentence
        jsxCreateElement("div", { class: "example-sentence" }, example.sentence),
        // English translation
        jsxCreateElement("div", { class: "example-translation" }, example.translation)
      )
    );
  }
}
