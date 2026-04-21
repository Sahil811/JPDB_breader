import { JapaneseDictionary } from "../dictionary.js";
import { readExtJson } from "../util.js";
import { kanjiApi } from "../integrations/api.js";

const dictionary = new JapaneseDictionary();
let dictionaryLoaded = false;
let kanjiMeaningsPromise = null;

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

export async function loadPopupSupplementalData(card, options = {}) {
  const { showKanji = true, showHindi = false } = options;
  let characterDetails = null;
  let hindiMeaning = null;

  if (showKanji) {
    const kanjiMap = await getKanjiMeaningsPromise();
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
  }

  if (showHindi) {
    await loadDictionary();
    hindiMeaning = dictionary.search(card.spelling);
  }

  return { characterDetails, hindiMeaning };
}
