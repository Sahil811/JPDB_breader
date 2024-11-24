export class JapaneseDictionary {
  constructor() {
    this.dictionary = null;
    this.kanjiIndex = new Map();
    this.kanaIndex = new Map();
  }

  async loadDictionary() {
    if (this.dictionary) return;

    try {
      const response = await fetch(
        chrome.runtime.getURL("japanese_dictionary_hindi.json")
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.dictionary = await response.json();
      this.buildIndices();
    } catch (error) {
      console.error("Error loading dictionary:", error);
      throw error;
    }
  }

  buildIndices() {
    if (!this.dictionary) return;

    this.dictionary.forEach((entry, idx) => {
      // Index kanji readings
      if (entry.kanji && Array.isArray(entry.kanji)) {
        entry.kanji.forEach((kanji) => {
          if (!this.kanjiIndex.has(kanji)) {
            this.kanjiIndex.set(kanji, []);
          }
          this.kanjiIndex.get(kanji).push(idx);
        });
      }

      // Index kana readings
      if (entry.kana && Array.isArray(entry.kana)) {
        entry.kana.forEach((kana) => {
          if (!this.kanaIndex.has(kana)) {
            this.kanaIndex.set(kana, []);
          }
          this.kanaIndex.get(kana).push(idx);
        });
      }
    });
  }

  findBestMatch(indices) {
    if (!indices || indices.length === 0) return null;

    // If there's only one match, return it
    if (indices.length === 1) {
      return this.dictionary[indices[0]];
    }

    // Get all potential matches
    const matches = indices.map((idx) => this.dictionary[idx]);

    // Sort matches by priority (you can adjust these criteria)
    matches.sort((a, b) => {
      // Prefer entries with both kanji and kana
      const aComplete = a.kanji?.length > 0 && a.kana?.length > 0;
      const bComplete = b.kanji?.length > 0 && b.kana?.length > 0;
      if (aComplete !== bComplete) return aComplete ? -1 : 1;

      // Prefer shorter meanings (usually more common/basic meanings)
      return (a.meaning?.length || 0) - (b.meaning?.length || 0);
    });

    return matches[0];
  }

  search(word) {
    if (!this.dictionary) {
      console.warn("Dictionary not loaded");
      return null;
    }

    try {
      // Try kanji lookup first
      const kanjiIndices = this.kanjiIndex.get(word) || [];
      if (kanjiIndices.length > 0) {
        const match = this.findBestMatch(kanjiIndices);
        if (match) return match;
      }

      // Try kana lookup if no kanji match
      const kanaIndices = this.kanaIndex.get(word) || [];
      if (kanaIndices.length > 0) {
        const match = this.findBestMatch(kanaIndices);
        if (match) return match;
      }

      return null;
    } catch (error) {
      console.error("Error during dictionary search:", error);
      return null;
    }
  }

  // Helper method to clean up resources if needed
  clear() {
    this.dictionary = null;
    this.kanjiIndex.clear();
    this.kanaIndex.clear();
  }
}
