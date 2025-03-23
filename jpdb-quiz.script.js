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
        .play-audio-btn {
            background: #3498db;
            border: none;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            cursor: pointer;
            padding: 0;
            margin-left: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            transition: background-color 0.2s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .play-audio-btn:hover {
            background-color: #2980b9;
        }

        .play-audio-btn:disabled {
            background-color: #ccc;
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
            background-color: #fff;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 5px 25px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            width: 85%;
            max-width: 650px;
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            font-family: "Noto Sans", sans-serif;
            overflow: hidden; /* Prevent scrollbar jumps */
        }

        #quiz-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
        }

        #quiz-title {
            margin: 0;
            color: #2c3e50;
            font-size: 1.5rem;
        }

        #quiz-close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #7f8c8d;
            transition: color 0.2s;
        }

        #quiz-close-btn:hover {
            color: #e74c3c;
        }

        .quiz-mode-selector {
            display: flex;
            flex-direction: column;
            margin-bottom: 25px;
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
        }

        .quiz-mode-title {
            font-weight: bold;
            margin-bottom: 12px;
            color: #34495e;
        }

        .quiz-mode-buttons {
            display: flex;
            gap: 10px;
        }

        .quiz-mode-btn {
            padding: 8px 15px;
            border-radius: 20px;
            border: 1px solid #ddd;
            background-color: #f1f1f1;
            cursor: pointer;
            transition: all 0.2s;
            flex: 1;
            text-align: center;
        }

        .quiz-mode-btn.active {
            background-color: #3498db;
            color: white;
            border-color: #2980b9;
        }

        #quiz-content {
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            flex: 1;
            min-height: 0;
            padding-right: 5px; /* Space for scrollbar */
        }

        .quiz-progress {
            margin-bottom: 15px;
            color: #7f8c8d;
            font-size: 0.9rem;
        }

        .quiz-score {
            margin-bottom: 20px;
            font-weight: bold;
            color: #2c3e50;
        }

        .quiz-question {
            font-size: 1.7rem;
            margin-bottom: 25px;
            padding: 20px;
            background-color: #f5f5f5;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            line-height: 1.4;
        }

        .quiz-question.jp {
            font-family: "Noto Sans JP", sans-serif;
        }

        .quiz-options-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 15px; /* Ensure space for button */
        }

        .quiz-option {
            padding: 15px;
            text-align: left;
            cursor: pointer;
            border: 2px solid #ddd;
            border-radius: 8px;
            background-color: white;
            transition: all 0.2s;
            font-size: 1.1rem;
            position: relative;
            overflow: hidden;
            /* Ensure content is vertically aligned */
            display: flex;
            align-items: center;
            min-height: 60px;
        }

        .quiz-option:hover:not(:disabled) {
            border-color: #3498db;
            background-color: #f8f9fa;
            transform: translateY(-2px);
        }

        .quiz-option:disabled {
            cursor: default;
        }

        .quiz-option.jp {
            font-family: "Noto Sans JP", sans-serif;
        }

        .quiz-option.correct {
            background-color: #d4edda;
            border-color: #c3e6cb;
        }

        .quiz-option.incorrect {
            background-color: #f8d7da;
            border-color: #f5c6cb;
        }

        .next-btn-container {
            margin-top: auto;
            padding-top: 15px;
            position: sticky;
            bottom: 0;
            background-color: #fff;
            z-index: 5;
        }

        .next-btn {
            width: 100%;
            padding: 12px;
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1.1rem;
            transition: background-color 0.2s;
        }

        .next-btn:hover {
            background-color: #2980b9;
        }

        .results-container {
            text-align: center;
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        .results-title {
            color: #2c3e50;
            margin-bottom: 20px;
        }

        .results-score {
            font-size: 1.3rem;
            margin: 20px 0;
        }

        .results-percentage {
            font-size: 3rem;
            font-weight: bold;
            margin: 30px 0;
            color: #3498db;
        }

        .results-message {
            margin: 25px 0;
            font-style: italic;
            color: #7f8c8d;
        }

        .restart-btn {
            display: block;
            margin: 30px auto;
            padding: 12px 25px;
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1.1rem;
            transition: background-color 0.2s;
        }

        .restart-btn:hover {
            background-color: #2980b9;
        }

        .quiz-settings-btn {
            background: none;
            border: none;
            color: #7f8c8d;
            cursor: pointer;
            margin-left: auto;
            margin-right: 10px;
            font-size: 18px;
            display: flex;
            align-items: center;
        }

        .quiz-settings-btn:hover {
            color: #34495e;
        }

        .quiz-settings-panel {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: none;
        }

        .settings-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .settings-label {
            font-weight: bold;
            color: #34495e;
        }

        .settings-input {
            width: 80px;
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }

        .progress-bar-container {
            height: 6px;
            background-color: #ecf0f1;
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 15px;
        }

        .progress-bar {
            height: 100%;
            background-color: #3498db;
            width: 0%;
            transition: width 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .fade-in {
            animation: fadeIn 0.3s ease;
        }

        .quiz-start-btn {
            display: inline-block;
            margin: 20px 0;
            padding: 12px 25px;
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
            transition: background-color 0.2s;
        }

        .quiz-start-btn:hover {
            background-color: #2980b9;
        }

        /* Keyboard shortcuts help */
        .keyboard-shortcuts {
            margin-top: 15px;
            padding: 10px;
            background-color: #f8f9fa;
            border-radius: 5px;
            font-size: 0.85rem;
            color: #7f8c8d;
        }

        .keyboard-shortcut-key {
            display: inline-block;
            padding: 2px 6px;
            background-color: #eee;
            border-radius: 3px;
            border: 1px solid #ddd;
            margin: 0 2px;
            font-family: monospace;
        }

        /* Loading indicator */
        .loading-container {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100px;
        }

        .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top-color: #3498db;
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Error message */
        .error-message {
            color: #e74c3c;
            padding: 15px;
            background-color: #f8d7da;
            border-radius: 5px;
            margin: 15px 0;
            text-align: center;
        }

        /* Review section */
        .review-section {
            margin-top: 20px;
            border-top: 1px solid #eee;
            padding-top: 20px;
        }

        .review-heading {
            font-weight: bold;
            margin-bottom: 10px;
        }

        .review-item {
            padding: 10px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
        }

        .review-item.incorrect {
            background-color: rgba(231, 76, 60, 0.1);
        }

        .review-word {
            font-family: "Noto Sans JP", sans-serif;
            font-weight: bold;
        }

        /* Tooltip */
        .tooltip {
            position: relative;
            display: inline-block;
        }

        .tooltip .tooltip-text {
            visibility: hidden;
            width: 120px;
            background-color: #555;
            color: #fff;
            text-align: center;
            border-radius: 6px;
            padding: 5px;
            position: absolute;
            z-index: 1;
            bottom: 125%;
            left: 50%;
            margin-left: -60px;
            opacity: 0;
            transition: opacity 0.3s;
        }

        .tooltip:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
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

            this.shuffledData = this.shuffleArray([...this.vocabularyData]);
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
            try {
                const state = {
                    currentQuestion: this.currentQuestion,
                    score: this.score,
                    quizMode: this.quizMode,
                    shuffledData: this.shuffledData,
                    incorrectAnswers: this.incorrectAnswers
                };
                localStorage.setItem('jpdbQuizState', JSON.stringify(state));
            } catch (e) {
                console.error('Failed to save quiz state:', e);
            }
        }

        // Try to restore quiz state from local storage
        tryRestoreState() {
            try {
                const savedState = localStorage.getItem('jpdbQuizState');
                if (!savedState) return false;

                const state = safeJSONParse(savedState);
                if (!state) return false;

                // Validate and restore state
                if (typeof state.currentQuestion === 'number' &&
                    typeof state.score === 'number' &&
                    (state.quizMode === 'word-to-meaning' || state.quizMode === 'meaning-to-word') &&
                    Array.isArray(state.shuffledData) &&
                    state.shuffledData.length >= this.options.optionsPerQuestion) {

                    this.currentQuestion = state.currentQuestion;
                    this.score = state.score;
                    this.quizMode = state.quizMode;
                    this.shuffledData = state.shuffledData;
                    this.incorrectAnswers = Array.isArray(state.incorrectAnswers) ? state.incorrectAnswers : [];

                    return true;
                }

                return false;
            } catch (e) {
                console.error('Failed to restore quiz state:', e);
                return false;
            }
        }

        generateOptions() {
            const currentVocab = this.getCurrentVocab();
            let correctOption;
            let optionPool;

            if (this.quizMode === 'word-to-meaning') {
                correctOption = currentVocab.meaning;
                optionPool = this.shuffledData.map(item => item.meaning);
            } else {
                correctOption = currentVocab.word;
                optionPool = this.shuffledData.map(item => item.word);
            }

            // Remove duplicates from option pool
            optionPool = [...new Set(optionPool)];

            // Remove the correct option from the pool
            optionPool = optionPool.filter(option => option !== correctOption);

            // Check if we have enough options
            if (optionPool.length < this.options.optionsPerQuestion - 1) {
                throw new Error('Not enough unique options available for quiz questions.');
            }

            // Retry option generation if necessary to avoid too similar distractors
            let attempts = 0;
            let wrongOptions;

            do {
                // Shuffle and take N-1 wrong options
                wrongOptions = this.shuffleArray(optionPool)
                    .slice(0, this.options.optionsPerQuestion - 1);

                // For Japanese options, ensure they don't have too much overlap with correct option
                if (this.quizMode === 'meaning-to-word') {
                    const correctChars = new Set(correctOption.split(''));
                    wrongOptions = wrongOptions.filter(option => {
                        // Calculate character overlap ratio
                        const optionChars = new Set(option.split(''));
                        const overlapSize = [...correctChars].filter(char => optionChars.has(char)).length;
                        const overlapRatio = overlapSize / correctOption.length;

                        // Reject options with high character overlap (>70%)
                        return overlapRatio <= 0.7;
                    });
                }

                attempts++;
            } while (wrongOptions.length < this.options.optionsPerQuestion - 1 && attempts < CONFIG.maxRetries);

            // If we still don't have enough options, fall back to using the top of the option pool
            if (wrongOptions.length < this.options.optionsPerQuestion - 1) {
                wrongOptions = optionPool.slice(0, this.options.optionsPerQuestion - 1);
            }

            // Create final options array with the correct option
            const options = [...wrongOptions, correctOption];

            // Shuffle options
            return this.shuffleArray(options);
        }

        shuffleArray(array) {
            const newArray = [...array];
            for (let i = newArray.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
            }
            return newArray;
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
                const options = this.contentArea.querySelectorAll('.quiz-option');
                if (options.length >= keyNum && !options[keyNum - 1].disabled) {
                    event.preventDefault();
                    options[keyNum - 1].click();
                }
                return;
            }

            // For "Next" button (Enter or Space)
            if ((event.key === 'Enter' || event.key === ' ') && !this.quiz.isQuizComplete()) {
                const nextButton = this.contentArea.querySelector('.next-btn');
                if (nextButton) {
                    event.preventDefault();
                    nextButton.click();
                }
                return;
            }

            // For "Restart" button (R key)
            if (event.key.toLowerCase() === 'r' && this.quiz.isQuizComplete()) {
                const restartButton = this.contentArea.querySelector('.restart-btn');
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
            const settingsPanel = document.getElementById('quiz-settings-panel');
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
                if (!word && !reading) {
                    throw new Error('No word or reading provided');
                }

                // Create a new audio context
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createBufferSource();
                
                // First fetch the audio source list
                const audioSources = await new Promise((resolve, reject) => {
                    const params = new URLSearchParams();
                    if (word) params.set('term', word);
                    if (reading) params.set('reading', reading);
                    
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `http://localhost:5050/?${params.toString()}`,
                        responseType: 'json',
                        onload: (response) => {
                            if (response.status === 200 && response.response.audioSources?.length > 0) {
                                resolve(response.response.audioSources);
                            } else {
                                reject(new Error('No audio sources found'));
                            }
                        },
                        onerror: (error) => reject(error)
                    });
                });

                // Try each audio source until one works
                for (const audioSource of audioSources) {
                    try {
                        const audioData = await new Promise((resolve, reject) => {
                            GM_xmlhttpRequest({
                                method: 'GET',
                                url: audioSource.url,
                                responseType: 'arraybuffer',
                                onload: (response) => {
                                    if (response.status === 200) {
                                        resolve(response.response);
                                    } else {
                                        reject(new Error(`Failed to fetch audio: ${response.statusText}`));
                                    }
                                },
                                onerror: (error) => reject(error)
                            });
                        });

                        // Decode and play the audio
                        const audioBuffer = await audioContext.decodeAudioData(audioData);
                        source.buffer = audioBuffer;
                        source.connect(audioContext.destination);
                        source.start(0);
                        return; // Success - exit the function
                    } catch (error) {
                        console.warn(`Failed to play audio from ${audioSource.name}:`, error);
                        // Try the next source
                    }
                }

                throw new Error('All audio sources failed to play');
                
            } catch (error) {
                console.error('Error playing audio:', error);
                alert('Failed to play audio. Please ensure the audio server is running on localhost:5050');
            }
        }

        renderQuestion() {
            const currentVocab = this.quiz.getCurrentVocab();
            const reading = currentVocab.reading || ''; // Get reading if available

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
                    playButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const url = `http://localhost:5050/?term=${encodeURIComponent(currentVocab.word)}&reading=${encodeURIComponent(currentVocab.reading || '')}`;
                        const audio = new Audio(url);
                        audio.play().catch(() => {
                            alert('Failed to play audio. Please ensure the audio server is running.');
                        });
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
                    playButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const vocab = this.quiz.shuffledData.find(v => v.word === option || v.meaning === option);
                        if (vocab) {
                            const url = `http://localhost:5050/?term=${encodeURIComponent(vocab.word)}&reading=${encodeURIComponent(vocab.reading || '')}`;
                            const audio = new Audio(url);
                            audio.play().catch(() => {
                                alert('Failed to play audio. Please ensure the audio server is running.');
                            });
                        }
                    });
                    
                    optionContainer.appendChild(textSpan);
                    optionContainer.appendChild(playButton);
                    optionButton.appendChild(optionContainer);
                }
                optionButton.textContent = option;
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
            const allOptions = optionsContainer.querySelectorAll('.quiz-option');
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
        const clone = wordLink.cloneNode(true);
        clone.querySelectorAll('rt').forEach(rt => rt.remove());
        return clone.textContent.trim();
    }

    // Extract vocabulary data from the JPDB page
    function extractVocabularyData(vocabList) {
        const vocabEntries = vocabList.querySelectorAll('.entry');
        return Array.from(vocabEntries)
            .map(entry => {
                try {
                    const spellingDiv = entry.querySelector('.vocabulary-spelling');
                    if (!spellingDiv) return null;
                    const wordLink = spellingDiv.querySelector('a');
                    if (!wordLink) return null;
                    const japaneseWord = extractJapaneseWord(wordLink);
                    if (!japaneseWord) return null;
                    let meaning = '';
                    if (spellingDiv.nextElementSibling) {
                        meaning = spellingDiv.nextElementSibling.textContent.trim();
                    }
                    if (!meaning) {
                        const possibleMeaningDivs = entry.querySelectorAll('div');
                        for (let i = 0; i < possibleMeaningDivs.length; i++) {
                            const text = possibleMeaningDivs[i].textContent.trim();
                            if (text && text.length > 3 && !text.includes('Top') &&
                                !text.includes('New') && isNaN(text)) {
                                meaning = text;
                                break;
                            }
                        }
                    }
                    // Extract reading from rt elements
                    const reading = Array.from(wordLink.querySelectorAll('rt'))
                        .map(rt => rt.textContent.trim())
                        .join('');

                    return {
                        word: japaneseWord,
                        meaning: meaning || 'Unknown meaning',
                        reading: reading
                    };
                } catch (error) {
                    console.error('Error extracting vocabulary:', error);
                    return null;
                }
            })
            .filter(item => item !== null);
    }

    // Initialize the quiz button on the page
    function initQuizButton() {
        const vocabList = document.querySelector('.vocabulary-list');
        if (!vocabList) return;
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
