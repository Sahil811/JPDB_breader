import { jsxCreateElement } from "../jsx.js";
import { nonNull } from "../util.js";

export const PARTS_OF_SPEECH = {
  n: "Noun",
  pn: "Pronoun",
  pref: "Prefix",
  suf: "Suffix",
  name: "Name",
  "name-fem": "Name (Feminine)",
  "name-male": "Name (Masculine)",
  "name-surname": "Surname",
  "name-person": "Personal Name",
  "name-place": "Place Name",
  "name-company": "Company Name",
  "name-product": "Product Name",
  "adj-i": "Adjective",
  "adj-na": "na-Adjective",
  "adj-no": "no-Adjective",
  "adj-pn": "Adjectival",
  "adj-nari": "nari-Adjective (Archaic/Formal)",
  "adj-ku": "ku-Adjective (Archaic)",
  "adj-shiku": "shiku-Adjective (Archaic)",
  adv: "Adverb",
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
  vt: "Transitive Verb",
  vi: "Intransitive Verb",
  v1: "Ichidan Verb",
  "v1-s": "Ichidan Verb (Irregular)",
  v5: "Godan Verb",
  v5u: "u Godan Verb",
  "v5u-s": "u Godan Verb (Irregular)",
  v5k: "ku Godan Verb",
  "v5k-s": "ku/iku Godan Verb (Irregular)",
  v5g: "gu Godan Verb",
  v5s: "su Godan Verb",
  v5t: "tsu Godan Verb",
  v5n: "nu Godan Verb",
  v5b: "bu Godan Verb",
  v5m: "mu Godan Verb",
  v5r: "ru Godan Verb",
  "v5r-i": "ru Godan Verb (Irregular)",
  v5aru: "aru Godan Verb (Irregular)",
  vk: "Irregular Verb (kuru)",
  vs: "suru Verb",
  vz: "zuru Verb",
  "vs-c": "Verb (Archaic)",
  v2: "Nidan Verb (Archaic)",
  v4: "Yodan Verb (Archaic)",
  v4k: "",
  v4g: "",
  v4s: "",
  v4t: "",
  v4h: "",
  v4b: "",
  v4m: "",
  v4r: "",
  va: "Archaic",
};

export function renderPitch(reading, pitch) {
  if (reading.length !== pitch.length - 1) {
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

    if (lastBorder !== reading.length) {
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

export function groupMeanings(card) {
  const groupedMeanings = [];
  let lastPOS = [];

  for (const [index, meaning] of card.meanings.entries()) {
    const samePartOfSpeech =
      meaning.partOfSpeech.length === lastPOS.length &&
      meaning.partOfSpeech.every((part, i) => part === lastPOS[i]);

    if (samePartOfSpeech) {
      groupedMeanings[groupedMeanings.length - 1].glosses.push(meaning.glosses);
      continue;
    }

    groupedMeanings.push({
      partOfSpeech: meaning.partOfSpeech,
      glosses: [meaning.glosses],
      startIndex: index,
    });
    lastPOS = meaning.partOfSpeech;
  }

  return groupedMeanings;
}

function createMeaningChunks(meanings, chunkSize = 3) {
  const validMeanings = meanings.filter(
    (meaning) => typeof meaning === "string" && meaning.trim().length > 0
  );

  return validMeanings.reduce((chunks, meaning, index) => {
    const chunkIndex = Math.floor(index / chunkSize);
    if (!chunks[chunkIndex]) chunks[chunkIndex] = [];
    chunks[chunkIndex].push(meaning);
    return chunks;
  }, []);
}

export function renderHindiMeanings(meanings) {
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
                      const moreMeanings = container.querySelector(".more-meanings");
                      const isExpanded = moreMeanings.classList.toggle("expanded");
                      e.target.textContent = isExpanded ? "-" : "+";
                    },
                  },
                  "+"
                ),
              ]
            : []),
        ]),
        hasMoreMeanings &&
          jsxCreateElement(
            "div",
            { class: "more-meanings" },
            meaningChunks.slice(1).map((chunk, index) =>
              jsxCreateElement("div", { class: "meaning-set" }, [
                jsxCreateElement("span", { class: "set-number" }, `${index + 2}. `),
                chunk.join("; "),
              ])
            )
          ),
      ].filter(Boolean)
    )
  );
}

export function createWordDetailsContent({
  card,
  characterDetails,
  hindiMeaning,
  onPlayAudio,
  onExplainWord,
}) {
  const url = `https://jpdb.io/vocabulary/${card.vid}/${encodeURIComponent(card.spelling)}/${encodeURIComponent(card.reading)}`;
  const kanjiUrl = (kanji) => `https://jpdb.io/kanji/${encodeURIComponent(kanji)}`;
  const groupedMeanings = groupMeanings(card);

  return [
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
                onPlayAudio();
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
                onExplainWord();
              },
            },
            "ℹ️"
          )
        )
      ),
      jsxCreateElement(
        "div",
        { class: "state" },
        card.state.map((state) => jsxCreateElement("span", { class: state }, state))
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
                { class: "kanji-item" },
                jsxCreateElement(
                  "a",
                  {
                    lang: "ja",
                    href: kanjiUrl(details.kanji),
                    target: "_blank",
                    class: "kanji-link"
                  },
                  jsxCreateElement("span", {}, `${details.kanji}:`)
                ),
                jsxCreateElement(
                  "a",
                  {
                    href: `https://kanji.koohii.com/study/kanji/${details.kanji}`,
                    target: "_blank",
                    class: "kanji-meaning-link"
                  },
                  jsxCreateElement("span", { class: "reading" }, details.meanings)
                )
              );
            })
        )
      : "",
    hindiMeaning?.meaning?.length ? renderHindiMeanings(hindiMeaning.meaning) : "",
    ...groupedMeanings.flatMap((meanings) => [
      jsxCreateElement(
        "h2",
        null,
        meanings.partOfSpeech
          .map(
            (pos) =>
              PARTS_OF_SPEECH[pos] ?? `(Unknown part of speech #${pos}, please report)`
          )
          .filter((value) => value.length > 0)
          .join(", ")
      ),
      jsxCreateElement(
        "ol",
        { start: meanings.startIndex + 1 },
        meanings.glosses.map((glosses) =>
          jsxCreateElement("li", null, glosses.join("; "))
        )
      ),
    ]),
  ];
}
