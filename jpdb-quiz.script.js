// ==UserScript==
// @name        JPDB Vocabulary Quiz - Enhanced
// @namespace   Violentmonkey Scripts
// @match       https://jpdb.io/anime/*/vocabulary-list*
// @match       https://jpdb.io/*/vocabulary-list*
// @match       https://jpdb.io/vocabulary-list/*
// @grant       GM_addStyle
// @grant       GM_xmlhttpRequest
// @connect     localhost
// @version     1.6
// @author      -
// @description Creates an enhanced interactive Japanese vocabulary quiz with multiple-choice questions
// @connect     localhost
// @connect-src localhost:5050
// @media-src   localhost:5050
// ==/UserScript==

(function() {
    'use strict';

    // ===== Configuration =====
    const CONFIG = {
        maxQuestions: 20,      // Maximum number of questions in a quiz
        minRequiredWords: 4,   // Minimum vocabulary words needed for quiz
        optionsPerQuestion: 4, // Number of answer options per question
        animationSpeed: 300,   // Animation speed in milliseconds
        minOptionLength: 2,    // Minimum length for valid answer options
        maxRetries: 50,        // Maximum number of retries for option generation
        debounceTime: 300      // Debounce time for button clicks (ms)
    };

    // ===== CSS Styles =====
    const STYLES = `
        :root {
            --md-sys-color-primary: #0b57d0;
            --md-sys-color-on-primary: #ffffff;
            --md-sys-color-surface: #ffffff;
            --md-sys-color-surface-container: #f3f3f3;
            --md-sys-color-on-surface: #1f1f1f;
            --md-sys-color-outline: #747775;
            --md-sys-color-outline-variant: #c4c7c5;
            --border-radius-pill: 9999px;
            --popup-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.25);
            --glass-blur: 16px;
        }

        .play-audio-btn {
            background: var(--md-sys-color-surface-container);
            border: none;
            border-radius: var(--border-radius-pill);
            width: 32px;
            height: 32px;
            cursor: pointer;
            padding: 0;
            margin-left: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--md-sys-color-on-surface);
            transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .play-audio-btn:hover {
            background-color: var(--md-sys-color-outline-variant);
            transform: scale(1.1);
        }

        .play-audio-btn:disabled {
            background-color: var(--md-sys-color-surface-container);
            opacity: 0.5;
            cursor: not-allowed;
        }

        .play-audio-btn .play-icon {
            margin-left: 2px;
            font-size: 14px;
        }

        .quiz-option .play-audio-btn {
            margin-left: auto;
            margin-right: 10px;
        }

        #jpdb-quiz-container {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: var(--md-sys-color-surface);
            backdrop-filter: blur(var(--glass-blur));
            -webkit-backdrop-filter: blur(var(--glass-blur));
            padding: 30px;
            border-radius: 24px;
            border: 1px solid var(--md-sys-color-outline-variant);
            box-shadow: var(--popup-shadow);
            z-index: 10000;
            width: 85%;
            max-width: 650px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            font-family: "Inter", "Roboto", "Noto Sans", sans-serif;
            color: var(--md-sys-color-on-surface);
            animation: modal-enter 0.4s cubic-bezier(0.2, 0, 0, 1) both;
        }
        
        @keyframes modal-enter {
            0% { opacity: 0; transform: translate(-50%, -45%) scale(0.95); }
            100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        #quiz-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
        }

        #quiz-title {
            margin: 0;
            color: var(--md-sys-color-primary);
            font-size: 1.6rem;
            font-weight: 700;
            letter-spacing: -0.02em;
        }

        #quiz-close-btn {
            background: none;
            border: none;
            font-size: 28px;
            cursor: pointer;
            color: var(--md-sys-color-outline);
            transition: color 0.2s, transform 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 50%;
        }

        #quiz-close-btn:hover {
            color: #d50000;
            background-color: var(--md-sys-color-surface-container);
            transform: scale(1.1);
        }

        .quiz-mode-selector {
            display: flex;
            flex-direction: column;
            margin-bottom: 25px;
            background-color: var(--md-sys-color-surface-container);
            padding: 15px;
            border-radius: 16px;
        }

        .quiz-mode-title {
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--md-sys-color-on-surface);
            font-size: 0.95rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .quiz-mode-buttons {
            display: flex;
            gap: 10px;
        }

        .quiz-mode-btn {
            padding: 10px 15px;
            border-radius: var(--border-radius-pill);
            border: none;
            background-color: transparent;
            color: var(--md-sys-color-on-surface);
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
            flex: 1;
            text-align: center;
            font-weight: 500;
            border: 1px solid var(--md-sys-color-outline-variant);
        }

        .quiz-mode-btn.active {
            background-color: var(--md-sys-color-primary);
            color: var(--md-sys-color-on-primary);
            border-color: var(--md-sys-color-primary);
            box-shadow: 0 4px 12px rgba(11, 87, 208, 0.3);
        }

        #quiz-content {
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            flex: 1;
            min-height: 0;
            padding-right: 5px;
        }

        .quiz-progress {
            margin-bottom: 10px;
            color: var(--md-sys-color-outline);
            font-size: 0.95rem;
            font-weight: 500;
            display: flex;
            justify-content: space-between;
        }

        .quiz-score {
            font-weight: 600;
            color: var(--md-sys-color-primary);
        }

        .quiz-question {
            font-size: 2rem;
            margin-bottom: 25px;
            padding: 35px 20px;
            background-color: var(--md-sys-color-surface-container);
            border-radius: 20px;
            text-align: center;
            font-weight: 700;
            box-shadow: inset 0 2px 5px rgba(0,0,0,0.02);
            line-height: 1.3;
            letter-spacing: -0.01em;
            color: var(--md-sys-color-on-surface);
        }

        .quiz-question.jp {
            font-family: "Noto Sans JP", sans-serif;
        }

        .quiz-options-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 15px;
        }

        .quiz-option {
            padding: 18px 20px;
            text-align: left;
            cursor: pointer;
            border: 2px solid transparent;
            border-radius: 16px;
            background-color: var(--md-sys-color-surface-container);
            transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
            font-size: 1.15rem;
            font-weight: 500;
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            min-height: 65px;
            color: var(--md-sys-color-on-surface);
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }

        .quiz-option:hover:not(:disabled) {
            border-color: var(--md-sys-color-primary);
            background-color: var(--md-sys-color-surface);
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.08);
        }

        .quiz-option:disabled {
            cursor: default;
        }

        .quiz-option.jp {
            font-family: "Noto Sans JP", sans-serif;
        }

        .quiz-option.correct {
            background-color: var(--md-sys-color-success-container);
            border-color: var(--md-sys-color-success);
            color: var(--md-sys-color-on-success-container);
        }

        .quiz-option.incorrect {
            background-color: var(--md-sys-color-error-container);
            border-color: var(--md-sys-color-error);
            color: var(--md-sys-color-on-error-container);
        }

        .next-btn-container {
            margin-top: auto;
            padding-top: 20px;
            position: sticky;
            bottom: 0;
            background-color: var(--md-sys-color-surface);
            z-index: 5;
            border-top: 1px solid var(--md-sys-color-surface-container);
        }

        .next-btn {
            width: 100%;
            padding: 16px;
            background-color: var(--md-sys-color-primary);
            color: var(--md-sys-color-on-primary);
            border: none;
            border-radius: var(--border-radius-pill);
            cursor: pointer;
            font-size: 1.15rem;
            font-weight: 600;
            transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
            box-shadow: 0 4px 12px rgba(11, 87, 208, 0.3);
        }

        .next-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(11, 87, 208, 0.4);
            filter: brightness(1.1);
        }

        .results-container {
            text-align: center;
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 20px 0;
        }

        .results-title {
            color: var(--md-sys-color-primary);
            margin-bottom: 20px;
            font-size: 2rem;
            font-weight: 800;
        }

        .results-score {
            font-size: 1.3rem;
            margin: 20px 0;
            color: var(--md-sys-color-outline);
        }

        .results-percentage {
            font-size: 4.5rem;
            font-weight: 800;
            margin: 20px 0;
            color: var(--md-sys-color-primary);
            letter-spacing: -0.05em;
        }

        .results-message {
            margin: 25px 0;
            font-weight: 500;
            color: var(--md-sys-color-on-surface);
            font-size: 1.2rem;
        }

        .restart-btn {
            display: block;
            margin: 30px auto;
            padding: 16px 40px;
            background-color: var(--md-sys-color-primary);
            color: white;
            border: none;
            border-radius: var(--border-radius-pill);
            cursor: pointer;
            font-size: 1.15rem;
            font-weight: 600;
            transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
            box-shadow: 0 4px 12px rgba(11, 87, 208, 0.3);
        }

        .restart-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(11, 87, 208, 0.4);
        }

        .quiz-settings-btn {
            background: var(--md-sys-color-surface-container);
            border: none;
            color: var(--md-sys-color-on-surface);
            cursor: pointer;
            margin-left: auto;
            margin-right: 15px;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .quiz-settings-btn:hover {
            background-color: var(--md-sys-color-outline-variant);
            transform: rotate(45deg);
        }

        .quiz-settings-panel {
            background-color: var(--md-sys-color-surface-container);
            padding: 20px;
            border-radius: 16px;
            margin-bottom: 25px;
            display: none;
            animation: fade-in 0.3s ease;
        }

        .settings-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .settings-label {
            font-weight: 600;
            color: var(--md-sys-color-on-surface);
            font-size: 0.95rem;
        }

        .settings-input {
            width: 90px;
            padding: 8px 12px;
            border: 1px solid var(--md-sys-color-outline-variant);
            border-radius: 8px;
            font-family: inherit;
            transition: all 0.2s;
        }
        
        .settings-input:focus {
            outline: none;
            border-color: var(--md-sys-color-primary);
            box-shadow: 0 0 0 2px rgba(11, 87, 208, 0.2);
        }

        .progress-bar-container {
            height: 8px;
            background-color: var(--md-sys-color-surface-container);
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 25px;
        }

        .progress-bar {
            height: 100%;
            background-color: var(--md-sys-color-primary);
            width: 0%;
            transition: width 0.4s cubic-bezier(0.2, 0, 0, 1);
            border-radius: 4px;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .fade-in {
            animation: fadeIn 0.4s cubic-bezier(0.2, 0, 0, 1) forwards;
        }

        .quiz-start-btn {
            display: inline-block;
            margin: 20px 0;
            padding: 16px 40px;
            background-color: var(--md-sys-color-primary);
            color: white;
            border: none;
            border-radius: var(--border-radius-pill);
            cursor: pointer;
            font-size: 1.15rem;
            font-weight: 600;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(11, 87, 208, 0.3);
        }

        .quiz-start-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(11, 87, 208, 0.4);
        }

        .keyboard-shortcuts {
            margin-top: 25px;
            padding: 15px;
            background-color: var(--md-sys-color-surface-container);
            border-radius: 12px;
            font-size: 0.85rem;
            color: var(--md-sys-color-outline);
            text-align: center;
        }

        .keyboard-shortcut-key {
            display: inline-block;
            padding: 4px 8px;
            background-color: var(--md-sys-color-surface);
            border-radius: 6px;
            border: 1px solid var(--md-sys-color-outline-variant);
            margin: 0 4px;
            font-family: monospace;
            font-weight: 600;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .loading-container {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 120px;
        }

        .loading-spinner {
            width: 48px;
            height: 48px;
            border: 4px solid var(--md-sys-color-surface-container);
            border-radius: 50%;
            border-top-color: var(--md-sys-color-primary);
            animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .error-message {
            color: var(--md-sys-color-on-error-container);
            padding: 20px;
            background-color: var(--md-sys-color-error-container);
            border-radius: 12px;
            margin: 20px 0;
            text-align: center;
            font-weight: 500;
            border: 1px solid var(--md-sys-color-error);
        }

        .review-section {
            margin-top: 30px;
            border-top: 2px solid var(--md-sys-color-surface-container);
            padding-top: 30px;
            text-align: left;
        }

        .review-heading {
            font-weight: 700;
            font-size: 1.3rem;
            margin-bottom: 20px;
            color: var(--md-sys-color-on-surface);
        }

        .review-item {
            padding: 16px;
            border-radius: 12px;
            margin-bottom: 12px;
            background-color: var(--md-sys-color-surface-container);
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s;
        }
        
        .review-item:hover {
            transform: translateX(4px);
        }

        .review-item.incorrect {
            background-color: var(--md-sys-color-error-container);
            border-left: 4px solid var(--md-sys-color-error);
            color: var(--md-sys-color-on-error-container);
        }

        .review-word {
            font-family: "Noto Sans JP", sans-serif;
            font-weight: 700;
            font-size: 1.15rem;
            color: var(--md-sys-color-on-surface);
        }
        
        .review-correct-answer {
            color: var(--md-sys-color-success);
            font-weight: 600;
            font-size: 0.95rem;
        }

        .tooltip {
            position: relative;
            display: inline-block;
        }

        .tooltip .tooltip-text {
            visibility: hidden;
            width: 140px;
            background-color: var(--md-sys-color-on-surface);
            color: var(--md-sys-color-surface);
            text-align: center;
            border-radius: 8px;
            padding: 8px 12px;
            position: absolute;
            z-index: 10;
            bottom: 130%;
            left: 50%;
            transform: translateX(-50%);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
            font-size: 0.85rem;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .tooltip .tooltip-text::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: var(--md-sys-color-on-surface) transparent transparent transparent;
        }

        .tooltip:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
            bottom: 140%;
        }
    `;

    // ===== Utility Functions =====
    // Debounce function to prevent rapid-fire clicks
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Check if a string is valid Japanese
    function containsJapanese(text) {
        return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(text);
    }

    // Check if a string is primarily English
    function isPrimarilyEnglish(text) {
        // Count English characters (basic Latin alphabet)
        const englishCharCount = (text.match(/[a-zA-Z]/g) || []).length;
        return englishCharCount > text.length / 2;
    }

    // Safe JSON parsing with error handling
    function safeJSONParse(str, defaultValue = null) {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.error('Error parsing JSON:', e);
            return defaultValue;
        }
    }

    const QUIZ_SELECTORS = Object.freeze({
        vocabularyList: ['.vocabulary-list'],
        entry: ['.entry'],
        spelling: ['.vocabulary-spelling'],
        wordLink: ['a'],
        readingRuby: ['rt'],
        settingsPanel: ['#quiz-settings-panel'],
        quizOption: ['.quiz-option'],
        nextButton: ['.next-btn'],
        restartButton: ['.restart-btn']
    });

    function queryFirst(root, selectors) {
        for (const selector of selectors) {
            const match = root.querySelector(selector);
            if (match) return match;
        }
        return null;
    }

    function queryAll(root, selectors) {
        const results = [];
        for (const selector of selectors) {
            results.push(...root.querySelectorAll(selector));
        }
        return results;
    }

    const jpdbVocabularyPage = {
        findVocabularyList(root = document) {
            return queryFirst(root, QUIZ_SELECTORS.vocabularyList);
        },

        getEntries(vocabList) {
            return queryAll(vocabList, QUIZ_SELECTORS.entry);
        },

        extractJapaneseWord(wordLink) {
            const clone = wordLink.cloneNode(true);
            queryAll(clone, QUIZ_SELECTORS.readingRuby).forEach(rt => rt.remove());
            return clone.textContent.trim();
        },

        extractMeaning(entry, spellingDiv) {
            let meaning = spellingDiv.nextElementSibling?.textContent.trim() || '';
            if (meaning) return meaning;

            const possibleMeaningDivs = entry.querySelectorAll('div');
            for (const element of possibleMeaningDivs) {
                const text = element.textContent.trim();
                if (text && text.length > 3 && !text.includes('Top') && !text.includes('New') && isNaN(text)) {
                    return text;
                }
            }

            return '';
        },

        extractEntry(entry) {
            try {
                const spellingDiv = queryFirst(entry, QUIZ_SELECTORS.spelling);
                if (!spellingDiv) return null;

                const wordLink = queryFirst(spellingDiv, QUIZ_SELECTORS.wordLink);
                if (!wordLink) return null;

                const japaneseWord = this.extractJapaneseWord(wordLink);
                if (!japaneseWord) return null;

                const reading = queryAll(wordLink, QUIZ_SELECTORS.readingRuby)
                    .map(rt => rt.textContent.trim())
                    .join('');

                return {
                    word: japaneseWord,
                    meaning: this.extractMeaning(entry, spellingDiv) || 'Unknown meaning',
                    reading
                };
            } catch (error) {
                console.error('Error extracting vocabulary:', error);
                return null;
            }
        }
    };

    function createQuizAudioService() {
        let audioContext = null;
        let currentSource = null;

        function stopCurrent() {
            if (currentSource) {
                try {
                    currentSource.stop();
                } catch (error) {
                    console.warn('Failed to stop quiz audio source:', error);
                }
                currentSource = null;
            }
        }

        function ensureAudioContext() {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            return audioContext;
        }

        function requestGM({ method, url, responseType }) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method,
                    url,
                    responseType,
                    onload: (response) => {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(response.response);
                        } else {
                            reject(new Error(`Request failed: ${response.status} ${response.statusText}`));
                        }
                    },
                    onerror: (error) => reject(error)
                });
            });
        }

        return {
            async play(word, reading) {
                if (!word && !reading) {
                    throw new Error('No word or reading provided');
                }

                const params = new URLSearchParams();
                if (word) params.set('term', word);
                if (reading) params.set('reading', reading);

                const response = await requestGM({
                    method: 'GET',
                    url: `http://localhost:5050/?${params.toString()}`,
                    responseType: 'json'
                });

                const audioSources = response?.audioSources ?? [];
                if (audioSources.length === 0) {
                    throw new Error('No audio sources found');
                }

                const context = ensureAudioContext();
                if (context.state === 'suspended') {
                    await context.resume();
                }

                for (const audioSource of audioSources) {
                    try {
                        const audioData = await requestGM({
                            method: 'GET',
                            url: audioSource.url,
                            responseType: 'arraybuffer'
                        });
                        const audioBuffer = await context.decodeAudioData(audioData);
                        const source = context.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(context.destination);
                        stopCurrent();
                        currentSource = source;
                        source.onended = () => {
                            if (currentSource === source) currentSource = null;
                        };
                        source.start(0);
                        return;
                    } catch (error) {
                        console.warn(`Failed to play audio from ${audioSource.name}:`, error);
                    }
                }

                throw new Error('All audio sources failed to play');
            }
        };
    }

    const quizAudioService = createQuizAudioService();

    const quizStateStorage = {
        key: 'jpdbQuizState',

        save(state) {
            try {
                localStorage.setItem(this.key, JSON.stringify(state));
            } catch (error) {
                console.error('Failed to save quiz state:', error);
            }
        },

        restore(minOptions) {
            try {
                const savedState = localStorage.getItem(this.key);
                if (!savedState) return null;

                const state = safeJSONParse(savedState);
                if (!state) return null;

                const isValid =
                    typeof state.currentQuestion === 'number' &&
                    typeof state.score === 'number' &&
                    (state.quizMode === 'word-to-meaning' || state.quizMode === 'meaning-to-word') &&
                    Array.isArray(state.shuffledData) &&
                    state.shuffledData.length >= minOptions;

                return isValid ? state : null;
            } catch (error) {
                console.error('Failed to restore quiz state:', error);
                return null;
            }
        }
    };

    function shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    function filterJapaneseDistractors(correctOption, wrongOptions) {
        const correctChars = new Set(correctOption.split(''));
        return wrongOptions.filter(option => {
            const optionChars = new Set(option.split(''));
            const overlapSize = [...correctChars].filter(char => optionChars.has(char)).length;
            const overlapRatio = overlapSize / correctOption.length;
            return overlapRatio <= 0.7;
        });
    }

    function generateQuizOptions({ currentVocab, shuffledData, quizMode, optionsPerQuestion }) {
        const correctOption = quizMode === 'word-to-meaning' ? currentVocab.meaning : currentVocab.word;
        let optionPool = quizMode === 'word-to-meaning'
            ? shuffledData.map(item => item.meaning)
            : shuffledData.map(item => item.word);

        optionPool = [...new Set(optionPool)].filter(option => option !== correctOption);

        if (optionPool.length < optionsPerQuestion - 1) {
            throw new Error('Not enough unique options available for quiz questions.');
        }

        let attempts = 0;
        let wrongOptions;

        do {
            wrongOptions = shuffleArray(optionPool).slice(0, optionsPerQuestion - 1);
            if (quizMode === 'meaning-to-word') {
                wrongOptions = filterJapaneseDistractors(correctOption, wrongOptions);
            }
            attempts++;
        } while (wrongOptions.length < optionsPerQuestion - 1 && attempts < CONFIG.maxRetries);

        if (wrongOptions.length < optionsPerQuestion - 1) {
            wrongOptions = optionPool.slice(0, optionsPerQuestion - 1);
        }

        return shuffleArray([...wrongOptions, correctOption]);
    }

    // ===== Data Model =====
    class VocabularyQuiz {
        constructor(vocabularyData, options = {}) {
            this.rawVocabularyData = vocabularyData;
            this.options = {
                maxQuestions: options.maxQuestions || CONFIG.maxQuestions,
                optionsPerQuestion: options.optionsPerQuestion || CONFIG.optionsPerQuestion
            };

            // Data validation and cleaning
            this.vocabularyData = this.validateAndCleanData(vocabularyData);

            // Track incorrect answers for review
            this.incorrectAnswers = [];

            this.reset();
        }

        validateAndCleanData(data) {
            // Filter out invalid entries
            return data.filter(item => {
                // Ensure word and meaning exist and are strings
                if (!item || typeof item.word !== 'string' || typeof item.meaning !== 'string') {
                    return false;
                }

                // Ensure word is Japanese and meaning is primarily English
                if (!containsJapanese(item.word) || !isPrimarilyEnglish(item.meaning)) {
                    return false;
                }

                // Ensure word and meaning are not too short
                if (item.word.length < 1 || item.meaning.length < CONFIG.minOptionLength) {
                    return false;
                }

                return true;
            });
        }

        reset() {
            // Clear previous incorrect answers if resetting after a completed quiz
            if (this.isQuizComplete()) {
                this.incorrectAnswers = [];
            }

            // Handle the case where we don't have enough valid vocabulary data
            if (this.vocabularyData.length < CONFIG.minRequiredWords) {
                throw new Error(`Not enough valid vocabulary words. Found ${this.vocabularyData.length}, need at least ${CONFIG.minRequiredWords}.`);
            }

            this.shuffledData = shuffleArray([...this.vocabularyData]);
            this.currentQuestion = 0;
            this.score = 0;
            this.totalQuestions = Math.min(this.shuffledData.length, this.options.maxQuestions);
            this.quizMode = 'word-to-meaning'; // Default mode

            // Save quiz state for recovery
            this.saveState();
        }

        setQuizMode(mode) {
            if (mode === 'word-to-meaning' || mode === 'meaning-to-word') {
                this.quizMode = mode;
                this.saveState();
            }
        }

        getCurrentVocab() {
            return this.shuffledData[this.currentQuestion];
        }

        isQuizComplete() {
            return this.currentQuestion >= this.totalQuestions;
        }

        incrementQuestion() {
            this.currentQuestion++;
            this.saveState();
        }

        incrementScore() {
            this.score++;
            this.saveState();
        }

        recordIncorrectAnswer(vocab, selectedOption) {
            this.incorrectAnswers.push({
                question: this.quizMode === 'word-to-meaning' ? vocab.word : vocab.meaning,
                correctAnswer: this.quizMode === 'word-to-meaning' ? vocab.meaning : vocab.word,
                selectedAnswer: selectedOption
            });
            this.saveState();
        }

        getScorePercentage() {
            return Math.round((this.score / this.totalQuestions) * 100);
        }

        getProgressPercentage() {
            return Math.round(((this.currentQuestion) / this.totalQuestions) * 100);
        }

        getIncorrectAnswers() {
            return this.incorrectAnswers;
        }

        // Save quiz state to local storage
        saveState() {
            quizStateStorage.save({
                currentQuestion: this.currentQuestion,
                score: this.score,
                quizMode: this.quizMode,
                shuffledData: this.shuffledData,
                incorrectAnswers: this.incorrectAnswers
            });
        }

        // Try to restore quiz state from local storage
        tryRestoreState() {
            const state = quizStateStorage.restore(this.options.optionsPerQuestion);
            if (!state) return false;

            this.currentQuestion = state.currentQuestion;
            this.score = state.score;
            this.quizMode = state.quizMode;
            this.shuffledData = state.shuffledData;
            this.incorrectAnswers = Array.isArray(state.incorrectAnswers) ? state.incorrectAnswers : [];

            return true;
        }

        generateOptions() {
            return generateQuizOptions({
                currentVocab: this.getCurrentVocab(),
                shuffledData: this.shuffledData,
                quizMode: this.quizMode,
                optionsPerQuestion: this.options.optionsPerQuestion
            });
        }

        getResultMessage() {
            const percentage = this.getScorePercentage();
            if (percentage >= 90) {
                return 'Amazing! You really know your Japanese vocabulary!';
            } else if (percentage >= 70) {
                return 'Great job! You have a good grasp of these words.';
            } else if (percentage >= 50) {
                return 'Good effort! With a bit more practice, you\'ll master these words.';
            } else {
                return 'Keep studying! These words will become familiar with practice.';
            }
        }
    }

    // ===== UI Components =====
    class QuizUI {
        constructor(vocabularyQuiz) {
            this.quiz = vocabularyQuiz;
            this.container = null;
            this.contentArea = null;
            this.settingsVisible = false;
            this.audioService = quizAudioService;

            // Track if quiz is fully initialized
            this.isInitialized = false;

            // Bind keyboard handlers
            this.handleKeyDown = this.handleKeyDown.bind(this);

            // Create debounced option click handler
            this.debouncedOptionClick = debounce(this.handleOptionClick.bind(this), CONFIG.debounceTime);
        }

        mount() {
            try {
                this.createContainer();
                document.body.appendChild(this.container);

                // Add keyboard event listener
                document.addEventListener('keydown', this.handleKeyDown);

                // Attempt to restore quiz state
                const restored = this.quiz.tryRestoreState();

                // Show loading indicator first
                this.showLoading();

                // Render after a short delay to ensure DOM is ready
                setTimeout(() => {
                    try {
                        this.render();
                        this.isInitialized = true;
                    } catch (error) {
                        this.showError(`Error initializing quiz: ${error.message}`);
                        console.error('Quiz initialization error:', error);
                    }
                }, 100);
            } catch (error) {
                console.error('Error mounting quiz UI:', error);
                alert(`Failed to start quiz: ${error.message}`);
            }
        }

        unmount() {
            if (this.container && this.container.parentNode) {
                // Remove keyboard listener
                document.removeEventListener('keydown', this.handleKeyDown);

                this.container.parentNode.removeChild(this.container);
                this.isInitialized = false;
            }
        }

        // Handle keyboard shortcuts
        handleKeyDown(event) {
            // Only process keyboard events if fully initialized
            if (!this.isInitialized) return;

            // Skip if user is in an input field
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            // Skip if settings panel is open
            if (this.settingsVisible) return;

            // For options (1-4 keys)
            const keyNum = parseInt(event.key);
            if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 4 && !this.quiz.isQuizComplete()) {
                const options = queryAll(this.contentArea, QUIZ_SELECTORS.quizOption);
                if (options.length >= keyNum && !options[keyNum - 1].disabled) {
                    event.preventDefault();
                    options[keyNum - 1].click();
                }
                return;
            }

            // For "Next" button (Enter or Space)
            if ((event.key === 'Enter' || event.key === ' ') && !this.quiz.isQuizComplete()) {
                const nextButton = queryFirst(this.contentArea, QUIZ_SELECTORS.nextButton);
                if (nextButton) {
                    event.preventDefault();
                    nextButton.click();
                }
                return;
            }

            // For "Restart" button (R key)
            if (event.key.toLowerCase() === 'r' && this.quiz.isQuizComplete()) {
                const restartButton = queryFirst(this.contentArea, QUIZ_SELECTORS.restartButton);
                if (restartButton) {
                    event.preventDefault();
                    restartButton.click();
                }
                return;
            }

            // For closing the quiz (Escape key)
            if (event.key === 'Escape') {
                event.preventDefault();
                this.unmount();
                return;
            }
        }

        showLoading() {
            if (!this.contentArea) return;

            this.contentArea.innerHTML = '';
            const loadingContainer = document.createElement('div');
            loadingContainer.className = 'loading-container';

            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';

            loadingContainer.appendChild(spinner);
            this.contentArea.appendChild(loadingContainer);
        }

        showError(message) {
            if (!this.contentArea) return;

            this.contentArea.innerHTML = '';
            const errorContainer = document.createElement('div');
            errorContainer.className = 'error-message';
            errorContainer.textContent = message;

            this.contentArea.appendChild(errorContainer);

            // Add close button
            const closeButtonContainer = document.createElement('div');
            closeButtonContainer.className = 'next-btn-container';

            const closeButton = document.createElement('button');
            closeButton.className = 'next-btn';
            closeButton.textContent = 'Close Quiz';
            closeButton.addEventListener('click', () => this.unmount());

            closeButtonContainer.appendChild(closeButton);
            this.contentArea.appendChild(closeButtonContainer);
        }

        createContainer() {
            this.container = document.createElement('div');
            this.container.id = 'jpdb-quiz-container';
            this.container.className = 'fade-in';

            // Create header
            const header = document.createElement('div');
            header.id = 'quiz-header';

            const title = document.createElement('h2');
            title.id = 'quiz-title';
            title.textContent = 'Japanese Vocabulary Quiz';

            const settingsButton = document.createElement('button');
            settingsButton.className = 'quiz-settings-btn';
            settingsButton.innerHTML = '⚙️';
            settingsButton.title = 'Quiz Settings';
            settingsButton.addEventListener('click', () => this.toggleSettings());

            const closeButton = document.createElement('button');
            closeButton.id = 'quiz-close-btn';
            closeButton.textContent = '×';
            closeButton.addEventListener('click', () => this.unmount());

            header.appendChild(title);
            header.appendChild(settingsButton);
            header.appendChild(closeButton);
            this.container.appendChild(header);

            // Create settings panel
            const settingsPanel = document.createElement('div');
            settingsPanel.className = 'quiz-settings-panel';
            settingsPanel.id = 'quiz-settings-panel';

            // Questions settings
            const questionsRow = document.createElement('div');
            questionsRow.className = 'settings-row';

            const questionsLabel = document.createElement('span');
            questionsLabel.className = 'settings-label';
            questionsLabel.textContent = 'Number of questions:';

            const questionsInput = document.createElement('input');
            questionsInput.className = 'settings-input';
            questionsInput.type = 'number';
            questionsInput.min = '5';
            questionsInput.max = '50';
            questionsInput.value = this.quiz.options.maxQuestions;
            questionsInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                if (value >= 5 && value <= 50) {
                    this.quiz.options.maxQuestions = value;

                    // Reset quiz with new options when count changes
                    try {
                        this.quiz.reset();
                        this.render();
                    } catch (error) {
                        this.showError(error.message);
                    }
                }
            });

            questionsRow.appendChild(questionsLabel);
            questionsRow.appendChild(questionsInput);
            settingsPanel.appendChild(questionsRow);

            // Options settings
            const optionsRow = document.createElement('div');
            optionsRow.className = 'settings-row';

            const optionsLabel = document.createElement('span');
            optionsLabel.className = 'settings-label';
            optionsLabel.textContent = 'Options per question:';

            const optionsInput = document.createElement('input');
            optionsInput.className = 'settings-input';
            optionsInput.type = 'number';
            optionsInput.min = '2';
            optionsInput.max = '6';
            optionsInput.value = this.quiz.options.optionsPerQuestion;
            optionsInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                if (value >= 2 && value <= 6) {
                    this.quiz.options.optionsPerQuestion = value;

                    // Reset quiz with new options when count changes
                    try {
                        this.quiz.reset();
                        this.render();
                    } catch (error) {
                        this.showError(error.message);
                    }
                }
            });

            optionsRow.appendChild(optionsLabel);
            optionsRow.appendChild(optionsInput);
            settingsPanel.appendChild(optionsRow);

            this.container.appendChild(settingsPanel);

            // Quiz Mode Selector
            const modeSelector = document.createElement('div');
            modeSelector.className = 'quiz-mode-selector';

            const modeTitle = document.createElement('div');
            modeTitle.className = 'quiz-mode-title';
            modeTitle.textContent = 'Quiz Mode:';

            const modeButtons = document.createElement('div');
            modeButtons.className = 'quiz-mode-buttons';

            const wordToMeaningBtn = document.createElement('button');
            wordToMeaningBtn.className = 'quiz-mode-btn active';
            wordToMeaningBtn.textContent = 'Japanese → English';
            wordToMeaningBtn.addEventListener('click', () => {
                this.quiz.setQuizMode('word-to-meaning');
                wordToMeaningBtn.classList.add('active');
                meaningToWordBtn.classList.remove('active');
                this.render();
            });

            const meaningToWordBtn = document.createElement('button');
            meaningToWordBtn.className = 'quiz-mode-btn';
            meaningToWordBtn.textContent = 'English → Japanese';
            meaningToWordBtn.addEventListener('click', () => {
                this.quiz.setQuizMode('meaning-to-word');
                meaningToWordBtn.classList.add('active');
                wordToMeaningBtn.classList.remove('active');
                this.render();
            });

            modeButtons.appendChild(wordToMeaningBtn);
            modeButtons.appendChild(meaningToWordBtn);
            modeSelector.appendChild(modeTitle);
            modeSelector.appendChild(modeButtons);
            this.container.appendChild(modeSelector);

            // Create content area
            this.contentArea = document.createElement('div');
            this.contentArea.id = 'quiz-content';
            this.container.appendChild(this.contentArea);
        }

        toggleSettings() {
            const settingsPanel = queryFirst(document, QUIZ_SELECTORS.settingsPanel);
            this.settingsVisible = !this.settingsVisible;
            settingsPanel.style.display = this.settingsVisible ? 'block' : 'none';
        }

        render() {
            // Clear content area
            this.contentArea.innerHTML = '';

            // If quiz is complete, render results
            if (this.quiz.isQuizComplete()) {
                this.renderResults();
            } else {
                this.renderQuestion();
            }
        }

        async playAudio(word, reading) {
            try {
                await this.audioService.play(word, reading);
            } catch (error) {
                console.error('Error playing audio:', error);
                alert('Failed to play audio. Please ensure the audio server is running on localhost:5050');
            }
        }

        renderQuestion() {
            const currentVocab = this.quiz.getCurrentVocab();

            // Progress bar
            const progressBarContainer = document.createElement('div');
            progressBarContainer.className = 'progress-bar-container';

            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.style.width = `${this.quiz.getProgressPercentage()}%`;

            progressBarContainer.appendChild(progressBar);
            this.contentArea.appendChild(progressBarContainer);

            // Progress text
            const progress = document.createElement('div');
            progress.className = 'quiz-progress';
            progress.textContent = `Question ${this.quiz.currentQuestion + 1} of ${this.quiz.totalQuestions}`;
            this.contentArea.appendChild(progress);

            // Score display
            const scoreDisplay = document.createElement('div');
            scoreDisplay.className = 'quiz-score';
            scoreDisplay.textContent = `Score: ${this.quiz.score}`;
            this.contentArea.appendChild(scoreDisplay);

            // Question display
            const questionContainer = document.createElement('div');
            questionContainer.className = 'quiz-question';

            const questionText = document.createElement('span');
            if (this.quiz.quizMode === 'word-to-meaning') {
                questionText.textContent = currentVocab.word;
                questionContainer.classList.add('jp');
                
                // Add play button for Japanese words
                if (this.quiz.quizMode === 'word-to-meaning') {
                    const playButton = document.createElement('button');
                    playButton.className = 'play-audio-btn';
                    playButton.innerHTML = '▶';
                    playButton.title = 'Play pronunciation';
                    playButton.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        await this.playAudio(currentVocab.word, currentVocab.reading || '');
                    });
                    questionContainer.appendChild(playButton);
                }
            } else {
                questionText.textContent = currentVocab.meaning;
            }

            questionContainer.appendChild(questionText);
            this.contentArea.appendChild(questionContainer);

            // Options
            const options = this.quiz.generateOptions();
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'quiz-options-container';

            options.forEach((option) => {
                const optionButton = document.createElement('button');
                optionButton.className = 'quiz-option';
                // Add play button for all Japanese options
                if (containsJapanese(option)) {
                    optionButton.classList.add('jp');
                    
                    const optionContainer = document.createElement('div');
                    optionContainer.style.display = 'flex';
                    optionContainer.style.alignItems = 'center';
                    optionContainer.style.width = '100%';
                    
                    const textSpan = document.createElement('span');
                    textSpan.textContent = option;
                    
                    const playButton = document.createElement('button');
                    playButton.className = 'play-audio-btn';
                    playButton.innerHTML = '▶';
                    playButton.title = 'Play pronunciation';
                    playButton.style.marginLeft = 'auto';
                    playButton.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const vocab = this.quiz.shuffledData.find(v => v.word === option || v.meaning === option);
                        if (vocab) {
                            await this.playAudio(vocab.word, vocab.reading || '');
                        }
                    });
                    
                    optionContainer.appendChild(textSpan);
                    optionContainer.appendChild(playButton);
                    optionButton.appendChild(optionContainer);
                } else {
                    optionButton.textContent = option;
                }
                optionButton.addEventListener('click', () => {
                    this.debouncedOptionClick(optionButton, option, optionsContainer);
                });
                optionsContainer.appendChild(optionButton);
            });

            this.contentArea.appendChild(optionsContainer);

            // Next button container (if answer already selected, it will be rendered later)
            const nextBtnContainer = document.createElement('div');
            nextBtnContainer.className = 'next-btn-container';
            this.contentArea.appendChild(nextBtnContainer);
        }

        handleOptionClick(optionButton, selectedOption, optionsContainer) {
            const currentVocab = this.quiz.getCurrentVocab();
            const correctOption = this.quiz.quizMode === 'word-to-meaning' ?
                                  currentVocab.meaning : currentVocab.word;

            // Disable all options
            const allOptions = queryAll(optionsContainer, QUIZ_SELECTORS.quizOption);
            allOptions.forEach(btn => btn.disabled = true);

            if (selectedOption === correctOption) {
                optionButton.classList.add('correct');
                this.quiz.incrementScore();
                const scoreDisplay = this.contentArea.querySelector('.quiz-score');
                scoreDisplay.textContent = `Score: ${this.quiz.score}`;
            } else {
                optionButton.classList.add('incorrect');
                this.quiz.recordIncorrectAnswer(currentVocab, selectedOption);
                allOptions.forEach(btn => {
                    if (btn.textContent === correctOption) {
                        btn.classList.add('correct');
                    }
                });
            }

            // Render next button in the next-btn-container
            const nextBtnContainer = this.contentArea.querySelector('.next-btn-container');
            nextBtnContainer.innerHTML = ''; // Clear previous content

            const nextButton = document.createElement('button');
            nextButton.className = 'next-btn';
            nextButton.textContent = this.quiz.currentQuestion === this.quiz.totalQuestions - 1 ?
                                     'See Results' : 'Next Question';
            nextButton.addEventListener('click', () => {
                this.quiz.incrementQuestion();
                this.render();
            });
            nextBtnContainer.appendChild(nextButton);
        }

        renderResults() {
            this.contentArea.innerHTML = '';

            const resultsContainer = document.createElement('div');
            resultsContainer.className = 'results-container fade-in';

            const resultsTitle = document.createElement('h2');
            resultsTitle.className = 'results-title';
            resultsTitle.textContent = 'Quiz Results';

            const scoreResult = document.createElement('p');
            scoreResult.className = 'results-score';
            scoreResult.textContent = `You scored ${this.quiz.score} out of ${this.quiz.totalQuestions}`;

            const percentage = this.quiz.getScorePercentage();
            const percentageDisplay = document.createElement('div');
            percentageDisplay.className = 'results-percentage';
            percentageDisplay.textContent = `${percentage}%`;

            const messageDisplay = document.createElement('p');
            messageDisplay.className = 'results-message';
            messageDisplay.textContent = this.quiz.getResultMessage();

            const restartButton = document.createElement('button');
            restartButton.className = 'restart-btn';
            restartButton.textContent = 'Restart Quiz';
            restartButton.addEventListener('click', () => {
                this.quiz.reset();
                this.render();
            });

            resultsContainer.appendChild(resultsTitle);
            resultsContainer.appendChild(scoreResult);
            resultsContainer.appendChild(percentageDisplay);
            resultsContainer.appendChild(messageDisplay);
            resultsContainer.appendChild(restartButton);

            // Optionally, display review of incorrect answers
            const incorrectAnswers = this.quiz.getIncorrectAnswers();
            if (incorrectAnswers.length > 0) {
                const reviewSection = document.createElement('div');
                reviewSection.className = 'review-section';

                const reviewHeading = document.createElement('div');
                reviewHeading.className = 'review-heading';
                reviewHeading.textContent = 'Review Incorrect Answers:';
                reviewSection.appendChild(reviewHeading);

                incorrectAnswers.forEach(item => {
                    const reviewItem = document.createElement('div');
                    reviewItem.className = 'review-item incorrect';

                    const questionText = document.createElement('div');
                    questionText.className = 'review-word';
                    questionText.textContent = item.question;

                    const answerText = document.createElement('div');
                    answerText.textContent = `Your answer: ${item.selectedAnswer} | Correct: ${item.correctAnswer}`;

                    reviewItem.appendChild(questionText);
                    reviewItem.appendChild(answerText);
                    reviewSection.appendChild(reviewItem);
                });
                resultsContainer.appendChild(reviewSection);
            }

            this.contentArea.appendChild(resultsContainer);
        }
    }

    // ===== Helper Functions =====
    // Extract the full Japanese word from a word link by removing any <rt> elements
    function extractJapaneseWord(wordLink) {
        return jpdbVocabularyPage.extractJapaneseWord(wordLink);
    }

    // Extract vocabulary data from the JPDB page
    function extractVocabularyData(vocabList) {
        return jpdbVocabularyPage.getEntries(vocabList)
            .map(entry => jpdbVocabularyPage.extractEntry(entry))
            .filter(item => item !== null);
    }

    // Initialize the quiz button on the page
    function initQuizButton() {
        const vocabList = jpdbVocabularyPage.findVocabularyList();
        if (!vocabList) return;
        if (document.querySelector('.quiz-start-btn')) return;
        const quizButton = document.createElement('button');
        quizButton.textContent = 'Start Vocabulary Quiz';
        quizButton.className = 'quiz-start-btn';
        vocabList.parentNode.insertBefore(quizButton, vocabList);
        quizButton.addEventListener('click', function() {
            const vocabularyData = extractVocabularyData(vocabList);
            if (vocabularyData.length < CONFIG.minRequiredWords) {
                alert(`Not enough vocabulary words for a quiz. Need at least ${CONFIG.minRequiredWords} words.`);
                return;
            }
            const quizModel = new VocabularyQuiz(vocabularyData);
            const quizUI = new QuizUI(quizModel);
            quizUI.mount();
        });
    }

    function initialize() {
        if (typeof GM_addStyle === 'function') {
            GM_addStyle(STYLES);
        } else {
            const styleElement = document.createElement('style');
            styleElement.textContent = STYLES;
            document.head.appendChild(styleElement);
        }
        initQuizButton();
    }

    window.addEventListener('load', initialize);
})();
