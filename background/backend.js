import { assertNonNull, truncate } from "../util.js";
import { addErrorContext, jpdbApi } from "../integrations/api.js";
import { config } from "./background.js";

const API_RATELIMIT = 0.2; // seconds between requests
const SCRAPE_RATELIMIT = 1.1; // seconds between requests

export async function parse(text) {
  let data;
  try {
    data = await jpdbApi.parse({ text, apiToken: config.apiToken });
  } catch (error) {
    throw addErrorContext(error, `while parsing "${truncate(text.join(" "), 20)}"`);
  }

  const cards = data.vocabulary.map((vocab) => {
    // NOTE: If you change these, make sure to change VOCAB_FIELDS too
    const [
      vid,
      sid,
      rid,
      spelling,
      reading,
      frequencyRank,
      partOfSpeech,
      meaningsChunks,
      meaningsPartOfSpeech,
      cardState,
      pitchAccent,
    ] = vocab;

    return {
      vid,
      sid,
      rid,
      spelling,
      reading,
      frequencyRank,
      partOfSpeech,
      meanings: meaningsChunks.map((glosses, i) => ({
        glosses,
        partOfSpeech: meaningsPartOfSpeech[i],
      })),
      state: cardState ?? ["not-in-deck"],
      pitchAccent: pitchAccent ?? [],
    };
  });

  const tokens = data.tokens.map((tokens) =>
    tokens.map((token) => {
      // NOTE: If you change these, make sure to change TOKEN_FIELDS too
      const [vocabularyIndex, position, length, furigana] = token;
      const card = cards[vocabularyIndex];
      let offset = position;
      const rubies =
        furigana === null
          ? []
          : furigana.flatMap((part) => {
              if (typeof part === "string") {
                offset += part.length;
                return [];
              }

              const [base, ruby] = part;
              const start = offset;
              const rubyLength = base.length;
              offset = start + rubyLength;
              return { text: ruby, start, end: offset, length: rubyLength };
            });

      return {
        card,
        start: position,
        end: position + length,
        length,
        rubies,
      };
    })
  );

  return [[tokens, cards], API_RATELIMIT];
}

export function addToDeck(vid, sid, deckId) {
  if (deckId === "forq") {
    return addToForqScrape(vid, sid);
  }
  return addToDeckAPI(vid, sid, deckId);
}

async function addToDeckAPI(vid, sid, deckId) {
  try {
    await jpdbApi.addVocabulary({
      deckId,
      vocabulary: [[vid, sid]],
      apiToken: config.apiToken,
    });
  } catch (error) {
    throw addErrorContext(error, `while adding word ${vid}/${sid} to deck "${deckId}"`);
  }

  return [null, API_RATELIMIT];
}

async function addToForqScrape(vid, sid) {
  let html;
  try {
    html = await jpdbApi.prioritize({ vid, sid });
  } catch (error) {
    throw addErrorContext(error, `while adding word ${vid}/${sid} to FORQ`);
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  if (doc.querySelector('a[href="/login"]') !== null) {
    throw Error("You are not logged in to jpdb.io - Adding cards to the FORQ requires being logged in");
  }

  return [null, SCRAPE_RATELIMIT];
}

export function removeFromDeck(vid, sid, deckId) {
  if (deckId === "forq") {
    return removeFromForqScrape(vid, sid);
  }
  return removeFromDeckAPI(vid, sid, deckId);
}

async function removeFromDeckAPI(vid, sid, deckId) {
  try {
    await jpdbApi.removeVocabulary({
      deckId,
      vocabulary: [[vid, sid]],
      apiToken: config.apiToken,
    });
  } catch (error) {
    throw addErrorContext(error, `while removing word ${vid}/${sid} from deck "${deckId}"`);
  }

  return [null, API_RATELIMIT];
}

async function removeFromForqScrape(vid, sid) {
  let html;
  try {
    html = await jpdbApi.deprioritize({ vid, sid });
  } catch (error) {
    throw addErrorContext(error, `while removing word ${vid}/${sid} from FORQ`);
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  if (doc.querySelector('a[href="/login"]') !== null) {
    throw Error("You are not logged in to jpdb.io - Removing cards from the FORQ requires being logged in");
  }

  return [null, SCRAPE_RATELIMIT];
}

export async function setSentence(vid, sid, sentence, translation) {
  try {
    await jpdbApi.setCardSentence({
      vid,
      sid,
      sentence,
      translation,
      apiToken: config.apiToken,
    });
  } catch (error) {
    const sentencePreview = sentence === undefined ? "none" : `"${truncate(sentence, 10)}"`;
    const translationPreview = translation === undefined ? "none" : `"${truncate(translation, 20)}"`;
    throw addErrorContext(
      error,
      `while setting sentence for word ${vid}/${sid} to ${sentencePreview} (translation: ${translationPreview})`
    );
  }

  return [null, API_RATELIMIT];
}

const REVIEW_GRADES = {
  nothing: "1",
  something: "2",
  hard: "3",
  good: "4",
  easy: "5",
  pass: "p",
  fail: "f",
  known: "k",
  unknown: "n",
  never_forget: "w",
  blacklist: "-1",
};

export async function review(vid, sid, rating) {
  let html;
  try {
    html = await jpdbApi.fetchReviewPage({ vid, sid });
  } catch (error) {
    throw addErrorContext(error, `while getting next review number for word ${vid}/${sid}`);
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  if (doc.querySelector('a[href="/login"]') !== null) {
    throw Error("You are not logged in to jpdb.io - Reviewing cards requires being logged in");
  }

  const reviewNoInput = doc.querySelector('form[action^="/review"] input[type=hidden][name=r]');
  assertNonNull(reviewNoInput);
  const reviewNo = parseInt(reviewNoInput.value, 10);

  try {
    await jpdbApi.submitReview({
      vid,
      sid,
      reviewNo,
      grade: REVIEW_GRADES[rating],
    });
  } catch (error) {
    throw addErrorContext(error, `while adding ${rating} review to word ${vid}/${sid}`);
  }

  return [null, 2 * SCRAPE_RATELIMIT];
}

export async function getCardState(vid, sid) {
  let data;
  try {
    data = await jpdbApi.lookupVocabulary({
      list: [[vid, sid]],
      fields: ["card_state"],
      apiToken: config.apiToken,
    });
  } catch (error) {
    throw addErrorContext(error, `while getting state for word ${vid}/${sid}`);
  }

  const vocabInfo = data.vocabulary_info[0];
  if (vocabInfo === null) {
    throw Error(`Can't get state for word ${vid}/${sid}, word does not exist`);
  }

  return [vocabInfo[0] ?? ["not-in-deck"], API_RATELIMIT];
}
