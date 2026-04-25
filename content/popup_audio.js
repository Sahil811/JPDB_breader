import {
  requestFetchAudioBytes,
  requestFetchAudioHash,
} from "./background_comms.js";

const JPDB_XOR_KEY = [0x06, 0x23, 0x54, 0x0f];
let currentAudio = null;

export const JpdbAudio = {
  cache: new Map(),

  async speak(vid, spelling) {
    if (currentAudio) {
      try {
        currentAudio.pause();
      } catch (e) { console.warn('JPDBreader: audio error', e); }
      currentAudio = null;
    }

    if (!vid) return;
    const hash = this.cache.get(vid) ?? (await this.scrapeHash(vid, spelling));
    if (hash) await this.play(hash);
  },

  async scrapeHash(vid, spelling) {
    try {
      const result = await requestFetchAudioHash(vid, spelling);
      if (result?.hash) {
        if (this.cache.size > 200) {
          this.cache.delete(this.cache.keys().next().value);
        }
        this.cache.set(vid, result.hash);
        return result.hash;
      }
    } catch (e) { console.warn('JPDBreader: audio error', e); }

    return null;
  },

  async play(hash) {
    try {
      const result = await requestFetchAudioBytes(hash);
      if (!result?.bytes) return;

      const buffer = new Uint8Array(result.bytes);
      for (let i = 0; i < Math.min(4, buffer.length); i++) {
        buffer[i] ^= JPDB_XOR_KEY[i];
      }

      const blobUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/ogg" }));
      const audio = new Audio(blobUrl);
      currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(blobUrl);
        currentAudio = null;
      };
      audio.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        currentAudio = null;
      };
      audio.play().catch(() => URL.revokeObjectURL(blobUrl));
    } catch (e) { console.warn('JPDBreader: audio error', e); }
  },
};
