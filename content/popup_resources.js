import { JapaneseDictionary } from "../dictionary.js";
import { readExtJson } from "../util.js";
import { kanjiApi } from "../integrations/api.js";

const dictionary = new JapaneseDictionary();
let dictionaryLoaded = false;
let kanjiMeaningsPromise = null;
let kanjiComponentsPromise = null;
let componentMeaningsPromise = null;

function isKanji(char) {
  return /\p{Script=Han}/u.test(char) && char !== "。";
}

async function loadDictionary() {
  if (dictionaryLoaded) return;

  try {
    await dictionary.loadDictionary();
    dictionaryLoaded = true;
  } catch (error) {
    console.error("Failed to load dictionary:", error);
  }
}

function getKanjiFromMap(map, char) {
  const meaning = map.get(char);
  return meaning ? { kanji: char, meaning } : null;
}

async function getKanjiMeaningsPromise() {
  if (kanjiMeaningsPromise) return kanjiMeaningsPromise;

  kanjiMeaningsPromise = (async () => {
    const data = await readExtJson("kanji_meanings.json");
    const map = new Map();
    for (const entry of data) {
      if (entry.kanji && entry.meaning) {
        map.set(entry.kanji, entry.meaning);
      }
    }
    return map;
  })().catch((error) => {
    console.error("Failed to load kanji_meanings.json:", error);
    kanjiMeaningsPromise = null;
    return new Map();
  });

  return kanjiMeaningsPromise;
}

async function getKanjiDetails(char, kanjiMap) {
  const local = getKanjiFromMap(kanjiMap, char);
  if (local) return local;

  try {
    return await kanjiApi.fetchKanji(char);
  } catch {
    return null;
  }
}

async function getKanjiComponentsMap() {
  if (kanjiComponentsPromise) return kanjiComponentsPromise;

  kanjiComponentsPromise = (async () => {
    const data = await readExtJson("kanji_components.json");
    // data is { kanji: [components] }
    return new Map(Object.entries(data));
  })().catch((error) => {
    console.error("Failed to load kanji_components.json:", error);
    kanjiComponentsPromise = null;
    return new Map();
  });

  return kanjiComponentsPromise;
}

async function getComponentMeaningsMap() {
  if (componentMeaningsPromise) return componentMeaningsPromise;

  componentMeaningsPromise = (async () => {
    const data = await readExtJson("component_meanings.json");
    // data is { component: meaning }
    return new Map(Object.entries(data));
  })().catch((error) => {
    console.error("Failed to load component_meanings.json:", error);
    componentMeaningsPromise = null;
    return new Map();
  });

  return componentMeaningsPromise;
}

export async function getComponentsForKanji(char) {
  const [kanjiMap, compMeaningsMap, kanjiCompMap] = await Promise.all([
    getKanjiMeaningsPromise(),
    getComponentMeaningsMap(),
    getKanjiComponentsMap(),
  ]);

  const comps = kanjiCompMap.get(char);
  if (!comps || !comps.length) return [];

  return comps.map((component) => {
    const meaning =
      kanjiMap.get(component) || compMeaningsMap.get(component) || "";
    return { component, meaning };
  });
}

export async function loadPopupSupplementalData(card, options = {}) {
  const { showKanji = true, showHindi = false } = options;
  let characterDetails = null;
  let hindiMeaning = null;
  let kanjiComponents = null;

  if (showKanji) {
    const [kanjiMap, compMeaningsMap, kanjiCompMap] = await Promise.all([
      getKanjiMeaningsPromise(),
      getComponentMeaningsMap(),
      getKanjiComponentsMap(),
    ]);

    characterDetails = (
      await Promise.all(
        [...card.spelling].filter(isKanji).map(async (char) => {
          const charDetails = await getKanjiDetails(char, kanjiMap);
          return charDetails
            ? {
                kanji: charDetails.kanji,
                meanings:
                  charDetails.meaning || charDetails.meanings?.join(", ") || "",
              }
            : null;
        })
      )
    ).filter(Boolean);

    characterDetails = characterDetails.length ? characterDetails : null;

    if (characterDetails) {
      kanjiComponents = new Map();
      for (const details of characterDetails) {
        const comps = kanjiCompMap.get(details.kanji) || [];
        const enriched = comps.map((component) => {
          const meaning =
            kanjiMap.get(component) || compMeaningsMap.get(component) || "";
          return { component, meaning };
        });
        kanjiComponents.set(details.kanji, enriched);
        // Attach directly for convenient rendering
        details.components = enriched;
      }
      if (kanjiComponents.size === 0) kanjiComponents = new Map();
    }
  }

  if (showHindi) {
    await loadDictionary();
    hindiMeaning = dictionary.search(card.spelling);
  }

  return { characterDetails, hindiMeaning, kanjiComponents };
}
