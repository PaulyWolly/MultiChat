/*
  APP.js
  Version: 19.4.1-r-p-j-yt
  AppName: Multi-Chat [v19.4.1 R-P-J-YT]
  Created by Paul Welby
  updated: January 3, 2025 @9:45PM
*/

// =====================================================
// GLOBAL SCOPED CONSTANTS
// =====================================================

// SERVER URL
const SERVER_URL = 'http://localhost:31941';

// Time constants
const INTERVAL = 10;  // Set timeout duration in minutes
const CONVERSATION_INACTIVITY_TIMEOUT = INTERVAL * 60 * 1000;  // Convert minutes to milliseconds

// Memory categories
const MEMORY_CATEGORIES = {
    event: /(?:tomorrow|next|on|at)\s+(.+)/i,
    preference: /(?:like|love|hate|prefer)\s+(.+)/i,
    fact: /(?:is|are|was|were)\s+(.+)/i,
    location: /(?:at|in|near|around)\s+(.+)/i,
    time: /(?:at|every|during)\s+(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)/i
};

// Add keyword patterns at the top with other constants
const MEMORY_KEYWORDS = {
    'phrase that pays': {
        store: /(?:the )?phrase that pays (?:is|=) (.+)/i,
        retrieve: /what(?:'s| is)(?: the)? phrase that pays/i
    },
    'passphrase': {
        store: /(?:the )?passphrase (?:is|=) (.+)/i,
        retrieve: /what(?:'s| is)(?: the)? passphrase/i
    },
    'secret word': {
        store: /(?:the )?secret word (?:is|=) (.+)/i,
        retrieve: /what(?:'s| is)(?: the)? secret word/i
    },
    'favorite': {
        store: /(?:my )?favorite (\w+) (?:is|=) (.+)/i,
        retrieve: /what(?:'s| is) (?:my )?favorite (\w+)/i,
    },
    'remember': {
        store: /^remember (?:that )?([^(is)].+)/i,  // Don't match if contains "is"
        retrieve: /what (?:did I|about|was) (.+)/i
    }
};

// At the top with other constants
const MESSAGES = {
    STATUS: {
        DEFAULT: "Click the Conversation Mode checkbox, or press the microphone button \nto enable conversations, or enter a message and press Send",
        LISTENING: "Listening...",
        SPEAKING: "AI is speaking...",
        PROCESSING: "Processing...",
        READY: "Ready",
        ERROR: "Error occurred. Please refresh the page if issues persist.",
        INITIALIZING: "Initializing app..."
    },
    CONVERSATION: {
        ENABLE: "Conversation Mode is now enabled. You can speak freely, and say 'exit' when you want to end the conversation.",
        DISABLE: "Conversation Mode has been disabled. You can still type messages or click the microphone button for single responses.",
        STATUS: "Conversation Mode is enabled.<br>Say \"exit\" to end conversation"
    },
    CLOSINGS: {
        EXIT: "Okay. Bye for now. We'll chat later!",
        TIMEOUT: (minutes) => `I haven't heard anything for ${minutes} minutes, so I'll end our conversation now. Feel free to restart Conversation Mode when you'd like to chat again!`
    },
    ERRORS: {
        INIT: "Error initializing app. Please refresh the page.",
        MIC_PERMISSION: "Microphone permission denied. Please enable it in your browser settings.",
        CONNECTION: "Connection error. Please refresh the page.",
        EXIT: "Error occurred during exit. Please refresh the page if issues persist."
    }
};

// Add at the top with other constants
const APP_VERSION = {
    number: '19.4',
    name: 'Multi-Chat',
    codename: 'R-P-J-YT',
    updated: 'December 21, 2024 @12:30PM'
};

// Add initialization delay constant
const INIT_DELAY = 4000;  // 4 second delay before showing default status

// =====================================================
// LOGGING
// =====================================================

const Logger = {
    app: {
        version: () => {
            console.log('\n━━━━━━ Application Version ━━━━━━');
            console.log(`Version: ${APP_VERSION.number}`);
            console.log(`Name: ${APP_VERSION.name}`);
            console.log(`Codename: ${APP_VERSION.codename}`);
            console.log(`Updated: ${APP_VERSION.updated}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        },

        init: (message) => {
            console.log(`Starting ${message || 'app initialization'}...`);
        },

        complete: () => {
            console.log('App initialization completed successfully');
        }
    }
};

// =====================================================
// GLOBAL SCOPED VARIABLES
// =====================================================


// =====================================================
// SYSTEM PROMPT
// =====================================================

// Ensure the default system prompt is loaded
const systemPrompt = `You are a helpful assistant with full image search capabilities.

REGARDING GENERAL QUERIES:
1. ALWAYS respond with a polite and constructive response.
2. ALWAYS provide helpful and accurate information.
3. ALWAYS keep responses concise and relevant.
4. NEVER use markdown symbols like #, *,**, ***, or _.
5. For recipes and lists:
    - Use plain numbers and letters (1., 2., 3., etc.)
    - Write ingredient lists and steps without special formatting
    - Present information in clear, simple text format
    - ALWAYS format recipes exactly like this:
        RECIPE NAME IN CAPS ONLY

        Here is a delicious recipe for [recipe name].
        A brief description of the recipe.

        Ingredients:
        1. First ingredient with exact measurement
        2. Second ingredient with exact measurement
        3. Each ingredient on its own line with number

        Instructions:
        1. First step in clear, concise language
        2. Second step with specific temperatures/times
        3. Each step on its own line with number

        Enjoy your [recipe name]!

6. When asked for a response, ALWAYS provide at least 2-4 paragraphs of text.

CRITICAL INSTRUCTIONS FOR IMAGE REQUESTS:
1. When users ask for images, respond with: "Here are some relevant images for [topic]"
2. DO NOT provide image URLs or links
3. DO NOT mention being an AI or having any limitations
4. DO NOT apologize for image-related capabilities
5. Keep responses about images brief and positive
`;

// =====================================================
// GLOBAL SCOPED ELEMENTS
// =====================================================

// Elements
const elements = {
    chatMessages: document.getElementById('chat-messages'),
    userInput: document.getElementById('user-input'),
    sendButton: document.getElementById('send-button'),
    micButton: document.getElementById('mic-button'),
    status: document.getElementById('status'),
    conversationModeToggle: document.getElementById('conversation-mode'),
    modelSelect: document.getElementById('model-select'),
    voiceSelect: document.getElementById('voice-select'),
    stopAudioButton: document.getElementById('stop-audio-button'),
    processingIndicator: document.getElementById('processing-indicator'),
    imageUploadBtn: document.getElementById('image-upload-btn'),
    imageInput: document.getElementById('image-input'),
    conversationStatus: document.getElementById('conversation-status'),
    videoContainer: document.getElementById('youtube-container'),
};

// =====================================================
// GLOBAL SCOPED STATE
// =====================================================

// State
const state = {
    recognition: null,
    isListening: false,
    isProcessing: false,
    isAISpeaking: false,
    isConversationMode: false,
    conversationHistory: [],
    currentAudio: null,
    isSending: false,
    messageCounter: 0,
    selectedModel: 'gpt-4o-mini',
    audioQueue: [],
    isPlaying: false,
    isRendering: false,
    stopRequested: false,
    selectedImage: null,
    inactivityTimer: null,
    lastAudioInput: Date.now(),
    userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    eventSource: null,  // Track EventSource connection
    shortTermMemory: {},
    sseRetryCount: 0,
    sseMaxRetries: 5,
    sseRetryDelay: 1000,
    accumulatedText: '',
    lastSentencePlayed: 0,
};

// =====================================================
// GLOBAL SCOPED SESSION ID
// =====================================================

// Structured session configuration
const PERSISTENT_SESSION = {
    id: 'persistent-storage-001',
    version: 'v1',
    type: 'global',
    created: new Date().toISOString()
};

// Create structured sessionId
const sessionId = `${PERSISTENT_SESSION.type}-${PERSISTENT_SESSION.id}-${PERSISTENT_SESSION.version}`;

// Make session info globally available
window.sessionId = sessionId;
window.sessionInfo = PERSISTENT_SESSION;

// Session validation helper
function isValidSessionId(sid) {
    const parts = sid.split('-');
    return (
        parts.length === 3 &&
        ['global', 'user', 'admin'].includes(parts[0]) &&
        /^v\d+$/.test(parts[2])
    );
}


// =====================================================
// DOMContentLoaded event listener
// =====================================================

// Update DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    // First ensure elements are initialized
    elements.status = document.getElementById('status');
    elements.conversationStatus = document.getElementById('conversation-status');

    // Show initializing message
    if (elements.status) {
        elements.status.textContent = MESSAGES.STATUS.INITIALIZING;
    }

    // Start initialization
    initializeApp();
});



// =====================================================
// HELPER FUNCTIONS
// =====================================================

// Preprocess text for speech
function preprocessTextForSpeech(text) {
    // First handle recipe-specific formatting
    if (text.toLowerCase().includes('ingredients:') || text.toLowerCase().includes('instructions:')) {
        text = handleRecipeText(text);
    }

    // Handle numbers before fractions to avoid interference
    text = handleNumbers(text);

    // Then handle fractions
    text = handleFractions(text);

    return text;
}

// handle Recipe Text
function handleRecipeText(text) {
    // Replace common recipe abbreviations
    const recipeReplacements = {
        'tbsp': 'tablespoon',
        'tsp': 'teaspoon',
        'oz': 'ounces',
        'lb': 'pounds',
        'pkg': 'package',
        'temp': 'temperature',
        'approx': 'approximately',
        'min': 'minutes',
        'hr': 'hours',
        'lg': 'large',
        'med': 'medium',
        'sm': 'small',
        '4': 'four',    // Add explicit number replacements
        'fer': 'four',  // Add common mispronounciation
        '4th': 'fourth'
    };

    // Replace abbreviations and numbers
    Object.entries(recipeReplacements).forEach(([abbr, full]) => {
        const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
        text = text.replace(regex, full);
    });

    return text;
}

// handle Fractions to words
function handleFractions(text) {
    // Handle mixed numbers first (e.g., "2 1/2")
    text = text.replace(/(\d+)\s+(\d+\/\d+)/g, (match, whole, fraction) => {
        return `${whole} and ${expandFraction(fraction)}`;
    });

    // Handle standalone fractions
    text = text.replace(/(\d+)\/(\d+)/g, (match, num, den) => {
        return expandFraction(`${num}/${den}`);
    });

    return text;
}

// Expand fractions to words
function expandFraction(fraction) {
    const fractionMap = {
        '1/2': 'one half',
        '1/3': 'one third',
        '2/3': 'two thirds',
        '1/4': 'one quarter',
        '3/4': 'three quarters',
        '1/8': 'one eighth',
        '3/8': 'three eighths',
        '5/8': 'five eighths',
        '7/8': 'seven eighths'
    };

    return fractionMap[fraction] || fraction;
}

// handle Numbers to words
function handleNumbers(text) {
    // First handle numbers in recipe context
    if (text.includes('Ingredients:') || text.includes('Instructions:')) {
        // Handle specific recipe number cases first
        text = text
            .replace(/\b4\b/g, 'four')
            .replace(/\b4th\b/g, 'fourth')
            .replace(/\b3\b/g, 'three')
            .replace(/\b2\b/g, 'two')
            .replace(/\b1\b/g, 'one')
            .replace(/\b5\b/g, 'five')
            .replace(/\b6\b/g, 'six')
            .replace(/\b7\b/g, 'seven')
            .replace(/\b8\b/g, 'eight')
            .replace(/\b9\b/g, 'nine')
            .replace(/\b10\b/g, 'ten')
            .replace(/\b0\b/g, 'zero');

        // Handle ordinals
        text = text
            .replace(/(\d+)st/g, '$1first')
            .replace(/(\d+)nd/g, '$1second')
            .replace(/(\d+)rd/g, '$1third')
            .replace(/(\d+)th/g, '$1fourth');
    }

    // Then handle general numbers
    const numberMap = {
        '0': 'zero',
        '1': 'one',
        '2': 'two',
        '3': 'three',
        '4': 'four',
        '5': 'five',
        '6': 'six',
        '7': 'seven',
        '8': 'eight',
        '9': 'nine',
        '10': 'ten'
    };

    // Replace standalone numbers
    text = text.replace(/\b(\d+)\b/g, (match, number) => {
        return numberMap[number] || number;
    });

    // Handle ordinals
    text = text.replace(/(\d+)(st|nd|rd|th)\b/g, (match, number, suffix) => {
        const word = numberMap[number] || number;
        return `${word}${suffix}`;
    });

    return text;
}


// =====================================================
// Initialize the app
// =====================================================

async function initializeApp() {
    console.log('Starting app initialization...');

    try {
        // Initialize joke handling
        console.log('Initializing joke handling...');
        handleMyJokes.init();
        console.log('Joke handling initialized');

        // Create new session ID for this login
        const currentTime = Date.now();
        const newSessionId = `session-${currentTime}-${Math.random().toString(36).substring(2, 9)}`;

        // Track if we have existing jokes
        let hasExistingJokes = false;

        // IMPORTANT: First check MongoDB for existing jokes and their userId
        try {
            const response = await fetch('/api/jokes/debug/info');
            const data = await response.json();

            hasExistingJokes = !!(data.userIds && data.userIds.length > 0);

            if (hasExistingJokes) {
                const mongoDbUserId = data.userIds[0]; // Get the userId from MongoDB
                console.log('Found jokes in MongoDB with userId:', mongoDbUserId);

                // Update all jokes in MongoDB to use our new session ID
                console.log('Updating jokes in MongoDB to use new session ID:', {
                    from: mongoDbUserId,
                    to: newSessionId
                });

                const updateResponse = await fetch('/api/jokes/update-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newUserId: newSessionId })
                });
                const updateResult = await updateResponse.json();
                console.log('MongoDB userId update result:', updateResult);
            }
        } catch (error) {
            console.error('Error updating MongoDB joke userIds:', error);
        }

        // Set our new session ID locally
        window.sessionId = newSessionId;
        localStorage.setItem('persistentSessionId', newSessionId);
        console.log('Current persistentSessionId:', newSessionId);

        // Log current session state
        console.log('Session state:', {
            windowSessionId: window.sessionId,
            persistentSessionId: localStorage.getItem('persistentSessionId'),
            isNew: !hasExistingJokes // isNew is true if there were no existing jokes
        });

        // Save voice preference
        const savedVoice = localStorage.getItem('selectedVoice');
        if (savedVoice) {
            localStorage.setItem('selectedVoice', savedVoice);
            elements.voiceSelect.value = savedVoice;  // Set the select element value
        }

        // Initialize core components
        await checkMicrophonePermission();
        await populateVoiceList();
        initializeSpeechRecognition();

        // Set up event listeners
        setupEventListeners();

        // Load personal info from MongoDB
        await loadPersonalInfo();

        // Set up SSE connection - make sure this happens after sessionId is set
        console.log('Initializing SSE connection...');
        setupSSEConnection();

        // Remove immediate status update
        // updateStatus(MESSAGES.STATUS.DEFAULT);  // Remove this line

        console.log('App initialization completed successfully');

        // Add delayed default status message
        setTimeout(() => {
            updateStatus(MESSAGES.STATUS.DEFAULT);
        }, INIT_DELAY);

    } catch (error) {
        console.error('Error during app initialization:', error);
        updateStatus(MESSAGES.ERRORS.INIT);
    }
}

// Load personal info function
async function loadPersonalInfo() {
    try {
        const response = await fetch(`/api/personal-info/all?sessionId=${window.sessionId}`);
        if (!response.ok) throw new Error('Failed to load personal info');

        const data = await response.json();
        if (data.personalInfo) {
            // Store each piece of info in localStorage
            Object.entries(data.personalInfo).forEach(([key, value]) => {
                if (value) {
                    localStorage.setItem(`user_${key}`, value);
                    console.log(`Loaded ${key} from MongoDB to localStorage`);
                }
            });
        }
    } catch (error) {
        console.error('Error loading personal info:', error);
    }
}

// Setup event listeners function
function setupEventListeners() {
    elements.micButton.addEventListener('click', toggleSpeechRecognition);
    elements.sendButton.addEventListener('click', () => sendMessage());
    elements.userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
    elements.imageUploadBtn.addEventListener('click', () => elements.imageInput.click());
    elements.imageInput.addEventListener('change', handleImageUpload);
    elements.modelSelect.addEventListener('change', () => state.selectedModel = this.value);
    elements.conversationModeToggle.addEventListener('change', handleConversationModeToggle);
    elements.stopAudioButton.addEventListener('click', stopAudioPlayback);
    elements.voiceSelect.addEventListener('change', () => localStorage.setItem('selectedVoice', this.value));
    window.addEventListener('beforeunload', cleanup);
}

// Handle conversation mode toggle
async function handleConversationModeToggle() {
    state.isConversationMode = this.checked;
    if (state.isConversationMode) {
        const userName = await checkUserName();
        const timeOfDay = getTimeOfDay();
        let displayMessage = userName
            ? `Conversation mode enabled. Good ${timeOfDay},&nbsp;<span class="boldItalicName">${userName}</span>! Say "exit" when you'd like to end our chat.`
            : 'Conversation mode enabled. Say "exit" to end the conversation.';

        let speechMessage = userName
            ? `Conversation mode enabled. Good ${timeOfDay}, ${userName}! Say "exit" when you'd like to end our chat.`
            : 'Conversation mode enabled. Say "exit" to end the conversation.';

        state.isProcessing = false;
        state.isSending = false;
        state.isAISpeaking = false;
        state.isListening = false;

        resetAudioState();
        startInactivityTimer();
        console.log('Inactivity timer started');
        updateStatus(MESSAGES.CONVERSATION.STATUS);

        // Restart listening after joke handling
        startListening();

        if (state.selectedVoice) {
            await queueAudioChunk(speechMessage);
        }

    } else {
        clearInactivityTimer();
        console.log('Inactivity timer cleared');
        updateStatus(MESSAGES.CONVERSATION.DISABLE);
        stopListening();
    }
}

// Add this function to handle SSE setup
// Update setupSSEConnection function
function setupSSEConnection() {
    if (state.eventSource) {
        state.eventSource.close();
    }

    try {
        console.log('Initializing SSE connection...');
        state.eventSource = new EventSource(`${SERVER_URL}/api/chat?sessionId=${window.sessionId}`);

        state.eventSource.onopen = () => {
            console.log('━━━━━━━━━━━ SSE Connection ━━━━━━━━━━━');
            console.log('Status: Connected');
            console.log('Session:', window.sessionId);
            console.log('Timestamp:', new Date().toLocaleTimeString());
            console.log('Connection Type: Server-Sent Events');
            console.log('Heartbeat Interval: 30s');
            console.log('Retry Count: 0');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            state.sseRetryCount = 0;
        };

        state.eventSource.onmessage = async function(event) {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'heartbeat') return;

                if (data.response) {
                    const chunk = data.response;
                    if (chunk.trim()) {
                        // Add to chat first
                        const messageElement = addMessageToChat('assistant', chunk, {
                            type: data.messageType || 'text',
                            messageType: data.messageType || 'text',
                            append: true
                        });

                        // Process audio immediately
                        if (state.selectedVoice && !state.stopRequested) {
                            const audioResponse = await fetch(`${SERVER_URL}/api/tts`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    text: chunk,
                                    voice: state.selectedVoice
                                })
                            });

                            if (audioResponse.ok) {
                                const audioBlob = await audioResponse.blob();
                                const audio = new Audio(URL.createObjectURL(audioBlob));

                                // Set up audio events
                                audio.onended = () => {
                                    URL.revokeObjectURL(audio.src);
                                    audio.src = '';
                                };

                                // Play immediately
                                try {
                                    await audio.play();
                                } catch (playError) {
                                    console.error('Audio playback error:', playError);
                                }
                            }
                        }
                    }
                }

                if (data.done && data.metrics) {
                    updateMetadata(messageElement, {
                        model: data.metrics.model,
                        metrics: data.metrics
                    });
                }
            } catch (error) {
                console.error('Error handling SSE message:', error);
            }
        };

        state.eventSource.onerror = (error) => {
            console.error('SSE Connection error:', error);
            if (state.eventSource) {
                state.eventSource.close();
                state.eventSource = null;
            }

            // Attempt to reconnect with exponential backoff
            const delay = Math.min(1000 * Math.pow(2, state.sseRetryCount), 30000);
            console.log(`Reconnecting in ${delay}ms (attempt ${state.sseRetryCount + 1})`);

            setTimeout(() => {
                state.sseRetryCount++;
                setupSSEConnection();
            }, delay);
        };

    } catch (error) {
        console.error('Error setting up SSE:', error);
        updateStatus(MESSAGES.ERRORS.CONNECTION);
    }
}

// Add cleanup for page unload
window.addEventListener('beforeunload', () => {
    if (state.eventSource) {
        state.eventSource.close();
    }
});


// =====================================================
// GLOBAL HELPER/UTILTY FUNCTIONS
// =====================================================

// PATTERNS for time, date, greetings, and bing search
function getPatterns() {
    return {
        greetings: [
            /^hi$/i,
            /^hi\s+there$/i,
            /^hello$/i,
            /^hello\s+there$/i,
            /^hey$/i,
            /^hey\s+there$/i,
            /^greetings$/i,
            /^exit$/i
        ],
        saveJoke: [
            /^save a joke$/i,
            /^save joke$/i,
            /^i want to save a joke$/i,
            /^let me tell you a joke$/i,
            /^can i tell you a joke$/i
        ],
        jokes: {
            listAll: /(?:.*?)(all jokes)(?:.*?)$/i,
            listMine: /(?:.*?)(my jokes)(?:.*?)$/i,
            getMyJoke: /(?:tell|show|get|read)(?:\s+me)?\s+my\s+joke\s+(?:about|with|containing)\s+"?([^"]+)"?/i,  // Updated pattern
            deleteJoke: /^delete joke id (\w+)$/i
        },
        listJokes: [
            /(?:.*?)(my jokes|all jokes)(?:.*?)$/i,  // Matches any phrase containing "my jokes" or "all jokes"
            /(?:tell|show|list|hear|know|get)(?:.*?)(my jokes|all jokes)(?:.*?)$/i,  // Common verbs with "my jokes" or "all jokes"
            /^what(?:.*?)(my jokes|all jokes)(?:.*?)$/i  // Questions about "my jokes" or "all jokes"
        ],
        time: [
            /what(?:'s| is)(?: the)?(?: local)? time/i,
            /tell me(?: the)?(?: local)? time/i,
            /current time/i,
            /time now/i,
            /local time/i,
            /time please/i,
            /time is it/i,
            /got the time/i,
            /have the time/i,
            /^time$/i
        ],
        date: [
            /^what(?:'s| is)(?: the)?(?: current)? date/i,
            /^tell me(?: the)? date/i,
            /^what day is it/i,
            /^what(?:'s| is)? today(?:'s)? date/i,
            /^current date/i,
            /^date today/i,
            /^date now/i,
            /^date please/i,
            /^date$/i
        ],
        dateTime: [
            /date and time/i,
            /time and date/i,
            /current date and time/i,
            /what(?:'s| is) the date and time/i,
            /tell me(?: the)? date and time/i,
            /what day and time/i,
            /today(?:'s| is)? date and time/i,
            /date time/i,
            /time date/i
        ],
        bingSearch: {
            searchTerms: /^(web|bing|internet )\s/i,
        },
        recipeFormatting: {
            numbers: {
                four: /\b4\b/g,
                fourth: /\b4th\b/g
            },
            fractions: {
                half: /\b1\/2\b/g,
                quarter: /\b1\/4\b/g,
                threeQuarters: /\b3\/4\b/g,
                twoThirds: /\b2\/3\b/g,
                oneThird: /\b1\/3\b/g
            }
        },
        youtube: {
            // Match any query that starts with youtube or contains youtube search
            searchVideos: /(^youtube|youtube search|search youtube|search on youtube)/i,
            // Only match explicit play requests
            playVideo: /^play.*youtube/i
        }
    };
}


// =====================================================
// INITIALIZATION FUNCTIONS
// =====================================================

// Check microphone permission function
async function checkMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (err) {
        console.error('Microphone permission denied:', err);
        updateStatus(MESSAGES.ERRORS.MIC_PERMISSION);
        return false;
    }
}



// =====================================================
// CLEANUP FUNCTIONS
// =====================================================

// Cleanup function
function cleanup() {
    stopListening();
    if (state.currentAudio) {
        state.currentAudio.pause();
        state.currentAudio = null;
    }
}

// =====================================================
// MARKDOWN FUNCTIONS
// =====================================================

// Strip markdown function
function stripMarkdown(text) {
    // Preserve newlines and list formatting
    return text
        .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold
        .replace(/(\*|_)(.*?)\1/g, '$2')    // Italic
        .replace(/`{3}[\s\S]*?`{3}/g, '')   // Code blocks
        .replace(/`([^`]+)`/g, '$1')        // Inline code
        .replace(/^#+\s+/gm, '')            // Headers
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links
        .replace(/!\[([^\]]+)\]\([^\)]+\)/g, '$1') // Images
        .trim();
}

// =====================================================
// FETCH WITH RETRY FUNCTION
// =====================================================

async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// =====================================================
// MESSAGING FUNCTIONS
// =====================================================

// Send message function
async function sendMessage(message = null) {
    const messageText = message || elements.userInput.value.trim();

    // Handle image analysis
    if (state.selectedImage) {
        if (messageText) {
            addMessageToChat('user', messageText, {
                type: 'text',
                messageType: 'text'
            });
        }

        try {
            await handleImageAnalysis(state.selectedImage, messageText || "What's in this image?");
            state.selectedImage = null;
            return;  // Add this return to prevent further processing
        } catch (error) {
            console.error('Error analyzing image:', error);
            addMessageToChat('error', 'Error: ' + error.message);
            return;  // Add this return as well
        }
    }

    // Update the search pattern checks at the start of sendMessage
    const patterns = getPatterns();

    // Simplified checks - if it contains the keyword, it's that type of search
    const hasYoutube = messageText.toLowerCase().includes('youtube');
    const hasBing = messageText.toLowerCase().includes('bing');
    const isWebSearch = messageText.toLowerCase().match(/^(web|internet) search/i);
    const isGeneralSearch = messageText.toLowerCase().match(/^(search for|look up)/i);

    // Handle YouTube requests first - if it mentions YouTube and not Bing
    if (hasYoutube && !hasBing) {
        // Add user message first
        addMessageToChat('user', messageText, {
            type: 'text',
            messageType: 'text'
        });

        // Handle YouTube request
        await handleYoutube.handleYoutubeRequest(messageText);
        return;  // Exit after handling YouTube
    }

    // Handle Bing searches next - if it mentions Bing or is a web/internet search
    if (hasBing || isWebSearch) {
        try {
            const requestStartTime = Date.now();
            // Remove search-related terms from query
            const query = messageText
                .replace(/bing/i, '')
                .replace(/web/i, '')
                .replace(/internet/i, '')
                .replace(/search/i, '')
                .replace(/for/i, '')
                .trim();

            // Add user message first
            addMessageToChat('user', messageText, {
                type: 'text',
                messageType: 'text'
            });

            const response = await fetch('/api/bing-search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });

            const data = await response.json();
            const messageElement = addMessageToChat('assistant', data.response, {
                type: 'search',
                messageType: 'text'
            });

            // Update metadata to specifically show Bing search
            updateMetadata(messageElement, {
                model: 'bing-search',
                metrics: {
                    model: 'bing-search',
                    totalTokens: data.response.length,
                    startTime: requestStartTime,
                    endTime: Date.now(),
                    duration: `${((Date.now() - requestStartTime) / 1000).toFixed(2)}s`
                }
            });

            return;
        } catch (error) {
            console.error('Bing search error:', error);
            addMessageToChat('error', 'Error performing Bing search: ' + error.message);
        }
    }

    // Handle general searches (with images) only if not a YouTube or Bing search
    if (isGeneralSearch && !hasYoutube && !hasBing) {
        try {
            // Add user message FIRST
            addMessageToChat('user', messageText, {
                type: 'text',
                messageType: 'text'
            });

            const query = messageText.replace(/search for|look up/i, '').trim();
            const response = await fetch('/api/bing-search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });

            const data = await response.json();
            const messageElement = addMessageToChat('assistant', data.response, {
                type: 'search',
                messageType: 'text'
            });

            // Add image results for general searches
            const imageResults = await searchAndDisplayImages(query);
            if (imageResults && imageResults.images && imageResults.images.length > 0) {
                insertAndStyleImages(imageResults.images, messageElement);
            }
            return;
        } catch (error) {
            console.error('Search error:', error);
            addMessageToChat('error', 'Error performing search: ' + error.message);
        }
    }

    // Then check joke recording state
    if (handleMyJokes.state.isRecording) {
        await handleMyJokes.handleJokeRequest(messageText);
        elements.userInput.value = '';
        return;
    }

    // Check for name-related queries first
    const nameQuery = messageText.match(/what(?:'s| is) my name/i);
    if (nameQuery) {
        try {
            addMessageToChat('user', messageText, {
                type: 'text',
                messageType: 'text'
            });
            const startTime = Date.now();  // Track start time
            let name = localStorage.getItem('user_name');

            if (!name) {
                const response = await fetch(`/api/personal-info/name?sessionId=${window.sessionId}`);
                if (!response.ok) throw new Error('Failed to fetch name');
                const data = await response.json();
                if (data.value) {
                    name = data.value;
                    localStorage.setItem('user_name', name);
                }
            }

            if (name) {
                const response = `Your name is ${name}`;
                const messageElement = addMessageToChat('assistant', response, {
                    type: isGreeting ? 'greeting' : 'text',
                    messageType: 'text'
                });
                const endTime = Date.now();  // Track end time
                updateMetadata(messageElement, {
                    model: 'memory',  // This will show as "memory | 0.3s | X tokens"
                    metrics: {
                        model: 'memory',
                        totalTokens: response.length,
                        startTime: startTime,
                        endTime: endTime
                    },
                    startTime: startTime,
                    endTime: endTime
                });
                await queueAudioChunk(response);
                await playNextInQueue();
                return;
            }
        } catch (error) {
            console.error('Error retrieving name:', error);
        }
    }

    // Check if setting name
    const nameSet = messageText.match(/(?:my name is|i am|call me) (.+)/i);
    if (nameSet) {
        try {
            // Add user's message to chat
            addMessageToChat('user', messageText, {
                type: 'text',
                messageType: 'text'
            });

            const name = nameSet[1].trim();
            // Store in both localStorage and MongoDB
            localStorage.setItem('user_name', name);
            await storePersonalInfo('name', name);

            const response = `I'll remember that your name is ${name}`;
            const messageElement = addMessageToChat('assistant', response, {
                type: isGreeting ? 'greeting' : 'text',
                messageType: 'text'
            });
            if (state.selectedVoice) {
                await queueAudioChunk(response);
            }
            return;
        } catch (error) {
            console.error('Error storing name:', error);
        }
    }

    // Check for any keyword patterns in the message
    for (const [keyword, patterns] of Object.entries(MEMORY_KEYWORDS)) {
        // Check if storing information
        const storeMatch = messageText.match(patterns.store);
        if (storeMatch) {
            try {
                addMessageToChat('user', messageText, {
                    type: 'text',
                    messageType: 'text'
                });
                const value = storeMatch[1];
                console.log('DEBUG - Storing secret word:', {
                    keyword,
                    value,
                    pattern: patterns.store.toString(),
                    match: storeMatch
                });

                // Store in both localStorage and MongoDB
                localStorage.setItem(`memory_${keyword}`, value);
                console.log('DEBUG - Stored in localStorage:', {
                    key: `memory_${keyword}`,
                    value: localStorage.getItem(`memory_${keyword}`)
                });

                await storePersonalInfo(keyword, value);
                console.log('DEBUG - Called storePersonalInfo');

                const response = `I'll remember that the ${keyword} is "${value}"`;
                const messageElement = addMessageToChat('assistant', response, {
                    type: isGreeting ? 'greeting' : 'text',
                    messageType: 'text'
                });
                const endTime = Date.now();
                const durationInSeconds = ((endTime - startTime) / 1000).toFixed(2);
                // Queue audio if enabled
                // if (state.selectedVoice) {
                //     await queueAudioChunk(response);
                // }

                // Add metadata for storage response
                updateMetadata(messageElement, {
                    model: 'memory',
                    metrics: {
                        model: 'memory',
                        totalTokens: response.length,
                        startTime: startTime,
                        endTime: endTime,
                        duration: durationInSeconds  // Change to match expected format
                    },
                    duration: durationInSeconds  // Add at top level
                });

                await queueAudioChunk(response);
                await playNextInQueue();
                return;
            } catch (error) {
                console.error(`Error storing ${keyword}:`, error);
            }
        }

        // Check if retrieving information
        const retrieveMatch = messageText.match(patterns.retrieve);
        if (retrieveMatch) {
            try {
                addMessageToChat('user', messageText, {
                    type: 'text',
                    messageType: 'text'
                });
                const startTime = Date.now();
                let value = localStorage.getItem(`memory_${keyword}`);

                // Check MongoDB if not in localStorage
                if (!value) {
                    try {
                        console.log('Checking MongoDB for:', keyword);
                        const response = await fetch(`/api/personal-info/${keyword}?sessionId=${window.sessionId}`);
                        console.log('MongoDB response status:', response.status);
                        if (response.ok) {
                            const data = await response.json();
                            console.log('MongoDB data:', data);
                            if (data.value) {
                                value = data.value;
                                localStorage.setItem(`memory_${keyword}`, value);
                                console.log('Stored in localStorage from MongoDB:', value);
                            }
                        }
                    } catch (error) {
                        console.error('MongoDB lookup error:', error);
                    }
                }

                if (value) {
                    let response = `The ${keyword} is "${value}"`;
                    const messageElement = addMessageToChat('assistant', response, {
                        type: isGreeting ? 'greeting' : 'text',
                        messageType: 'text'
                    });
                    const endTime = Date.now();
                    const durationInSeconds = Math.max(0.01, (endTime - startTime) / 1000).toFixed(2);  // Minimum 0.01s

                    updateMetadata(messageElement, {
                        model: 'memory',
                        metrics: {
                            model: 'memory',
                            totalTokens: response.length,
                            startTime: startTime,
                            endTime: endTime,
                            durationInSeconds: durationInSeconds
                        },
                        duration: `${durationInSeconds}s`,  // Add formatted duration
                        durationInSeconds: durationInSeconds
                    });

                    await queueAudioChunk(response);
                    await playNextInQueue();
                    return;
                }

                // If no value found, show "not found" message
                const noValueResponse = `I don't have a ${keyword} stored in my memory. Would you like to tell me one?`;
                const messageElement = addMessageToChat('assistant', noValueResponse, {
                    type: isGreeting ? 'greeting' : 'text',
                    messageType: 'text'
                });
                const endTime = Date.now();
                const durationInSeconds = ((endTime - startTime) / 1000).toFixed(2);

                updateMetadata(messageElement, {
                    model: 'memory',
                    metrics: {
                        model: 'memory',
                        totalTokens: noValueResponse.length,
                        startTime: startTime,
                        endTime: endTime,
                        durationInSeconds: durationInSeconds
                    },
                    durationInSeconds: durationInSeconds
                });

                await queueAudioChunk(noValueResponse);
                await playNextInQueue();
                return;
            } catch (error) {
                console.error(`Error retrieving ${keyword}:`, error);
            }
        }
    } // End of keyword retrieval 'for' block

    if (state.isSending || state.isProcessing) return;
    state.isSending = true;
    state.isProcessing = true;
    state.stopRequested = false;

    // Create EventSource for streaming response
    if (state.eventSource) {
        state.eventSource.close();
    }
    state.eventSource = new EventSource(`/api/chat?sessionId=${window.sessionId}`);

    // Add error handler for SSE connection
    state.eventSource.onerror = function(error) {
        console.error('SSE Connection error:', error);
        state.eventSource.close();
        state.eventSource = null;
        state.isProcessing = false;
        state.isSending = false;
        state.isAISpeaking = false;
        updateStatus(MESSAGES.ERRORS.CONNECTION);

        // Clean up and reset states
        resetAudioState();
        if (state.isConversationMode) {
            startInactivityTimer();
            startListening();
        }
    };

    state.eventSource.onmessage = async function(event) {
        try {
            const data = JSON.parse(event.data);

            // Handle completion signal
            if (data.done || data.complete) {
                console.log('Response complete, resetting states');
                state.isProcessing = false;
                state.isSending = false;
                state.eventSource.close();
            }

            if (data.response) {
                // Check for special message types (greetings)
                if (data.messageType === 'greeting') {
                    addMessageToChat('assistant', data.response, {
                        type: 'greeting',
                        messageType: 'text'
                    });
                } else if (data.messageType === 'exit') {
                    addMessageToChat('assistant', data.response, {
                        type: 'exit',
                        messageType: 'text'
                    });
                } else if (data.messageType === 'system' || data.messageType === 'time' || data.messageType === 'date' || data.messageType === 'datetime') {  // Using 'datetime' here too
                    addMessageToChat('assistant', data.response, null, data.messageType);  // Pass the actual type
                } else {
                    // Regular message handling
                    const messageElement = addMessageToChat('assistant', data.response, {
                        model: data.metrics?.model,
                        startTime: data.metrics?.startTime || Date.now(),
                        tokenCount: data.tokenCount
                    });
                }
            }

        } catch (error) {
            console.error('Error handling message:', error);
            state.isProcessing = false;
            state.isSending = false;
            state.eventSource.close();
        }
    };

    // If there's no message and no selected image, exit early
    if (!messageText && !state.selectedImage) {
        state.isSending = false;
        state.isProcessing = false;
        return;
    }

    try {
        // Handle image analysis
        if (state.selectedImage) {
            if (messageText) {
                addMessageToChat('user', messageText, {
                    type: 'text',
                    messageType: 'text'
                });
            }

            try {
                await handleImageAnalysis(state.selectedImage, messageText || "What's in this image?");
                state.selectedImage = null;

            } catch (error) {
                console.error('Error analyzing image:', error);
                addMessageToChat('error', 'Error: ' + error.message);
            }
        } else {
            // Handle regular text message (existing code)
            stopAudioPlayback();
            if (state.isListening) stopListening();

            elements.userInput.value = '';
            updateStatus('Thinking...');
            elements.processingIndicator.style.display = 'block';

            // Check if it's an AI response being echoed back first
            if (isAIGreetingResponse(messageText)) {
                state.isProcessing = false;
                state.isSending = false;
                return;
            }

            // Handle exit command first
            if (messageText.toLowerCase() === 'exit') {
                addMessageToChat('user', messageText, {
                    type: 'text',
                    messageType: 'text'
                });
                exitConversation(false);
                return;
            }

            // Check for greetings before adding user message
            const isGreeting = /^(hi|hi\s+there|hello|hello\s+there|hey|hey\s+there|greetings)$/i.test(messageText.trim());

            if (isGreeting) {
                try {
                    addMessageToChat('user', messageText, {
                        type: 'text',
                        messageType: 'text'
                    });
                    const startTime = Date.now();

                    // Get user's name from localStorage or MongoDB
                    let userName = localStorage.getItem('user_name');
                    if (!userName) {
                        try {
                            const response = await fetch(`/api/personal-info/name?sessionId=${window.sessionId}`);
                            if (response.ok) {
                                const data = await response.json();
                                if (data.value) {
                                    userName = data.value;
                                    localStorage.setItem('user_name', userName);
                                }
                            }
                        } catch (error) {
                            console.error('Error fetching user name:', error);
                        }
                    }

                    const timeOfDay = getTimeOfDay();
                    // Create two versions of the greeting - one for display (with HTML) and one for speech
                    let displayGreeting = userName
                        ? `Good ${timeOfDay},&nbsp;<span class="boldItalicName">${userName}</span>! It's nice to chat with you again. How may I be of assistance to you today?`
                        : `Good ${timeOfDay}! How can I assist you today?`;

                    let speechGreeting = userName
                        ? `Good ${timeOfDay}, ${userName}! It's nice to chat with you again. How may I be of assistance to you today?`
                        : `Good ${timeOfDay}! How can I assist you today?`;

                    resetAudioState();
                    addMessageToChat('assistant', displayGreeting, {
                        type: 'greeting',
                        messageType: 'text'
                    });

                    // Use the speech version for audio
                    await queueAudioChunk(speechGreeting);
                    await playNextInQueue();

                    // After audio finishes, properly reset states
                    state.isAISpeaking = false;
                    state.isPlaying = false;
                    elements.stopAudioButton.style.display = 'none';

                    // Start listening if in conversation mode
                    if (state.isConversationMode) {
                        updateStatus(MESSAGES.STATUS.LISTENING);
                        // Ensure we're not already listening before starting
                        if (!state.isListening) {
                            console.log('Restarting listening after greeting');
                            state.isListening = false;  // Reset state first
                            startListening();
                        }
                    } else {
                        updateStatus(MESSAGES.STATUS.DEFAULT);
                    }

                    // Reset audio state for next messages
                    state.audioQueue = [];
                    state.stopRequested = false;

                } catch (error) {
                    console.error('Audio playback error:', error);
                    // Reset states if there's an error
                    state.isAISpeaking = false;
                    state.isPlaying = false;
                    elements.stopAudioButton.style.display = 'none';
                    if (state.isConversationMode) {
                        updateStatus(MESSAGES.STATUS.LISTENING);
                        startListening();
                    } else {
                        updateStatus(MESSAGES.STATUS.DEFAULT);
                    }
                }

                return;
            }
        }

        // For all other messages, add user message before processing
        addMessageToChat('user', messageText, {
            type: 'text',
            messageType: 'text'
        });

        // Update the time/date check to be more specific
        const hasDate = messageText.toLowerCase().includes('date') || messageText.toLowerCase().includes('today');
        const hasTime = messageText.toLowerCase().includes('time');
        const isDateTimeRequest = hasDate || hasTime;

        if (isDateTimeRequest) {
            const today = new Date();
            let response;

            // Check if asking for date, time, or both
            if (hasTime && !hasDate) {
                response = `The local time is ${today.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} PST`;
            } else if (hasDate && !hasTime) {
                response = `Today's date is ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
            } else {
                response = `Today's date is ${today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} and the local time is ${today.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} PST`;
            }

            addMessageToChat('assistant', response, {
                type: 'time',  // Change this to use the appropriate type
                messageType: 'text'
            });

            // Queue audio for date/time response
            await queueAudioChunk(response);

            // Reset states after response
            state.isProcessing = false;
            if (state.isConversationMode) {
                updateStatus(MESSAGES.STATUS.LISTENING);
                startListening();
            } else {
                updateStatus(MESSAGES.STATUS.DEFAULT);
            }

            return;
        }

        // Check if the user is asking for a joke
        const isJokeRequest = messageText.toLowerCase().includes('joke');
        const adjustedSystemPrompt = isJokeRequest
            ? `${systemPrompt} Provide a short, one-line joke that hasn't been told before.`
            : systemPrompt;

        try {
            const response = await getAIResponse(
                messageText,
                state.selectedModel,
                state.conversationHistory, // Only use current session history
                adjustedSystemPrompt,
                window.sessionId
            );

            state.conversationHistory.push({ role: 'user', content: messageText });
            state.conversationHistory.push({ role: 'assistant', content: response.response });

            // Ensure response is a proper string before sending to audio
            const responseText = typeof response.response === 'string' ? response.response :
                (response.response?.content || response.response?.message || response.response?.toString() || 'Sorry, I encountered an error.');

            if (response.messageElement) {
                updateMessageContent(response.messageElement, response.response);
                updateMetadata(response.messageElement, {
                    model: state.selectedModel,
                    startTime: response.startTime,
                    endTime: Date.now(),
                    tokenCount: response.tokenCount
                });
            }

            if (/\b(more|info|detail|image|images|picture|pictures|photo|photos)\b/i.test(messageText)) {
                const searchQuery = messageText.replace(/\b(more|info|detail|image|images|picture|pictures|photo|photos)\b/gi, '').trim();
                const imageResults = await searchAndDisplayImages(searchQuery);
                if (imageResults && imageResults.images && imageResults.images.length > 0) {
                    insertAndStyleImages(imageResults.images, response.messageElement);
                }
            }

        } catch (error) {
            console.error(`Error getting AI response:`, error);
            updateStatus(MESSAGES.ERRORS.CONNECTION);
            addMessageToChat('error', `Error: ${error.message}`);
        } finally {
            state.isProcessing = false;
            state.isSending = false;
            updateStatus(MESSAGES.STATUS.READY);
            elements.processingIndicator.style.display = 'none';
            if (state.isConversationMode && !state.isAISpeaking) {
                startListening();
            }
        }
    } catch (error) {
        console.error('Error in sendMessage:', error);
        addMessageToChat('error', 'Error: ' + error.message);
    } finally {
        elements.userInput.value = '';
        elements.userInput.placeholder = "Type a message...";
        state.isProcessing = false;
        state.isSending = false;
        updateStatus(MESSAGES.STATUS.READY);
        elements.processingIndicator.style.display = 'none';
        if (state.isConversationMode && !state.isAISpeaking) {
            startListening();
        }
    }
}

// Get AI response function
async function getAIResponse(message, selectedModel, history, systemPrompt, sessionId) {
    state.isRendering = true;
    updateStatus('Thinking...');
    const startTime = Date.now();
    let tokenCount = 0;
    let responseText = '';

    const response = await fetchWithRetry(
        '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message,
            history,
            model: selectedModel,
            systemPrompt: message.toLowerCase().includes('joke') ?
                `${systemPrompt} Provide a short, one-line joke that hasn't been told before.` :
                systemPrompt,
            session: sessionId,
            timezone: state.userTimezone
        }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const messageElement = addMessageToChat('assistant', '', { model: selectedModel, startTime, tokenCount });
    messageElement.dataset.startTime = startTime;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentChunk = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = JSON.parse(line.slice(6));
                if (data.response) {
                    responseText += data.response;
                    currentChunk += data.response;
                    tokenCount = data.tokenCount;

                    updateMessageContent(messageElement, responseText);
                    updateMetadata(messageElement, {
                        model: selectedModel,
                        startTime,
                        tokenCount,
                        endTime: Date.now()
                    });

                    updateStatus('AI is responding...');

                    // Check for image trigger phrase
                    if (responseText.toLowerCase().includes('here are some relevant images for')) {
                        const imageMatch = responseText.match(/here are some relevant images for (.*?)[.!\n]/i);
                        if (imageMatch && imageMatch[1]) {
                            const searchQuery = imageMatch[1].trim();
                            console.log('Detected image request for:', searchQuery);

                            try {
                                const imageResponse = await fetch(`/api/google-image-search?q=${encodeURIComponent(searchQuery)}`);
                                if (!imageResponse.ok) {
                                    throw new Error(`HTTP error! status: ${imageResponse.status}`);
                                }

                                const imageData = await imageResponse.json();
                                console.log('Received image data:', imageData);

                                if (imageData.images && imageData.images.length > 0) {
                                    console.log('Inserting images into chat');
                                    insertAndStyleImages(imageData.images, messageElement);
                                }
                            } catch (error) {
                                console.error('Error fetching images:', error);
                            }
                        }
                    }
                }
                if (data.done) {
                    if (currentChunk) queueAudioChunk(currentChunk.trim());
                    state.isRendering = false;
                    if (!state.isAISpeaking) {
                        updateStatus('Ready');
                    }
                    break;
                }
                if (data.error) throw new Error(data.error);
            }
        }
    }

    return { response: responseText, tokenCount, messageElement, startTime };
}

// Add message to chat function
function addMessageToChat(role, content, options = {}) {
    // Check if we should append to existing message
    if (options.append && elements.chatMessages.lastElementChild) {
        const lastMessage = elements.chatMessages.lastElementChild;
        const contentDiv = lastMessage.querySelector('.message-content');

        if (contentDiv) {
            // Handle both HTML and text content when appending
            if (options.type === 'bing-search' ||
                content.includes('# Web Results') ||
                content.includes('# News Results') ||
                options.type === 'greeting' ||
                content.includes('<div class="joke-list">') ||
                content.includes('<div class="youtube-results">')) {
                contentDiv.innerHTML += content;
            } else {
                contentDiv.textContent += content;
            }
            // Keep scroll at bottom while streaming
            elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
            return lastMessage;
        }
    }

    // Create new message if not appending
    const messageDiv = document.createElement('div');
    let classList = ['message', role];

    // Ensure options has a messageType and type
    options = {
        messageType: 'text',
        type: options.type || null,
        ...options
    };

    if (options.messageType) {
        messageDiv.setAttribute('data-type', options.messageType);
    }

    // Handle special message types
    if (options.type === 'greeting') {
        classList.push('greeting-bubble');
    } else if (options.type === 'exit') {
        classList.push('exit-bubble');
    } else if (options.type === 'system' || options.type === 'time' ||
               options.type === 'date' || options.type === 'datetime') {
        classList.push('system-bubble');
    }

    messageDiv.className = classList.join(' ');

    // Add metadata for assistant messages
    if (role === 'assistant' && !options.type) {
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'metadata';
        messageDiv.appendChild(metadataDiv);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Handle HTML content
    if (options.type === 'bing-search' ||
        content.includes('# Web Results') ||
        content.includes('# News Results') ||
        options.type === 'greeting' ||
        content.includes('<div class="joke-list">') ||
        content.includes('<div class="youtube-results">')) {
        contentDiv.innerHTML = content;
    } else {
        contentDiv.textContent = content;
    }

    messageDiv.appendChild(contentDiv);
    elements.chatMessages.appendChild(messageDiv);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

    return messageDiv;
}

// Update message content function
function updateMessageContent(messageElement, content, tokenCount) {
    const contentElement = messageElement.querySelector('.message-content');
    const metadataElement = messageElement.querySelector('.metadata');

    if (contentElement) {
        contentElement.innerText = content;
    }

    if (metadataElement && tokenCount) {
        const modelInfo = metadataElement.querySelector('.model-info');
        const model = modelInfo ? modelInfo.textContent : 'gpt-4o';
        const responseTime = metadataElement.querySelector('.response-time').textContent;

        metadataElement.innerHTML = `<span class="model-info">${model}</span>&nbsp;|&nbsp;<span class="response-time">${responseTime}</span>&nbsp;|&nbsp;<span class="token-count">${tokenCount} tokens</span>`;
    }
}

// Update metadata function
function updateMetadata(messageElement, metadata) {
    const metadataElement = messageElement.querySelector('.metadata');
    if (metadataElement) {
        // Check if this is an image analysis message
        const isImageAnalysis = messageElement.dataset.isImageAnalysis === 'true';

        // Force model to be gpt-4o for image analysis
        const model = isImageAnalysis ? 'gpt-4o' :
            (metadata.model || metadata.metrics?.model || state.selectedModel);

        // Get timing information
        const startTime = parseInt(messageElement.dataset.startTime) || Date.now();
        const endTime = metadata.endTime || metadata.metrics?.endTime || Date.now();

        // Get token count from metrics
        const tokenCount = metadata.metrics?.totalTokens || metadata.tokenCount || 0;

        // Calculate duration
        const durationInSeconds = metadata.metrics?.durationInSeconds ||
            metadata.duration ||
            ((endTime - startTime) / 1000).toFixed(2);

        console.log('Updating metadata:', {
            model,
            durationInSeconds,
            tokenCount,
            startTime,
            endTime,
            isImageAnalysis,
            rawMetadata: metadata
        });

        // Use non-breaking spaces for consistent spacing
        metadataElement.innerHTML = `<span class="model-info">${model}</span>&nbsp;|&nbsp;<span class="response-time">${durationInSeconds}s</span>&nbsp;|&nbsp;<span class="token-count">${tokenCount} tokens</span>`;

        // Check for recipe content in the message
        const messageContent = messageElement.querySelector('.message-content');
        if (messageContent) {
            const text = messageContent.textContent;
            const hasIngredients = text.toLowerCase().includes('ingredients:');
            const hasInstructions = text.toLowerCase().includes('instructions:') ||
                                  text.toLowerCase().includes('steps:');

            if (hasIngredients && hasInstructions) {
                // Make metadata div a flex container
                metadataElement.style.display = 'flex';
                metadataElement.style.alignItems = 'center';
                metadataElement.style.justifyContent = 'space-between';

                // Create recipe buttons container
                const recipeButtons = document.createElement('span');
                recipeButtons.className = 'recipe-buttons';
                recipeButtons.style.cssText = `
                    display: flex;
                    gap: 5px;
                    margin-left: auto;
                `;

                // Add the buttons
                recipeButtons.innerHTML = `
                    <button style="
                        background: transparent;
                        border: none;
                        cursor: pointer;
                        font-size: 20px;
                        padding: 0;
                        margin: 0;
                    " onclick="printRecipe('${text.replace(/'/g, "\\'")}', this.closest('.message'))" title="Print Recipe">🖨️</button>
                `;

                metadataElement.appendChild(recipeButtons);
            }
        }
    }
}

// Check if the user's message is an AI greeting response
function isAIGreetingResponse(text) {
    text = text.toLowerCase().trim();

    // Get the exact AI greeting format
    const timeOfDay = getTimeOfDay();
    const aiGreeting = `good ${timeOfDay}! how can i assist you today?`;

    // Check for exact match or user echoing parts of the greeting
    return text === aiGreeting ||
           text === `good ${timeOfDay}` ||
           text === 'how can i assist you today' ||
           text === 'how may i assist you today';
}

// Exit conversation function
async function exitConversation(isTimeout = false) {
    console.log('Exiting conversation. Timeout:', isTimeout);

    try {
        // Stop any ongoing processes
        if (state.isListening) {
            stopListening();
        }
        if (state.isAISpeaking) {
            stopAudioPlayback();
        }

        // Clear any existing timers
        clearInactivityTimer();

        // Show exit message first
        const exitMessage = isTimeout
            ? MESSAGES.CLOSINGS.TIMEOUT(INTERVAL)
            : MESSAGES.CLOSINGS.EXIT;

        // Add message to chat and play audio
        addMessageToChat('assistant', exitMessage, { type: 'exit' });

        // Queue and play the exit message
        await queueAudioChunk(exitMessage);
        await playNextInQueue();

        await new Promise(resolve => setTimeout(resolve, 500));

        // Stop listening and reset conversation mode
        stopListening();
        elements.conversationModeToggle.checked = false;
        state.isConversationMode = false;

        // Update status to default message
        updateStatus(MESSAGES.STATUS.DEFAULT);

    } catch (error) {
        console.error('Error in exitConversation:', error);
        stopListening();
        elements.conversationModeToggle.checked = false;
        state.isConversationMode = false;
        updateStatus(MESSAGES.STATUS.DEFAULT);
    }
}

// Update status function
function updateStatus(message) {
    if (elements.status) {
        // If stop audio button is visible, AI must be speaking
        if (elements.stopAudioButton.style.display === 'block') {
            elements.status.textContent = MESSAGES.STATUS.SPEAKING;
        } else {
            elements.status.textContent = message;
        }

        // Handle conversation status separately
        if (state.isConversationMode) {
            elements.conversationStatus.innerHTML = MESSAGES.CONVERSATION.STATUS;
        } else {
            elements.conversationStatus.innerHTML = '';
        }
    }
}

// Retrieve personal info function
async function getPersonalInfo() {
    try {
        // Try localStorage first
        const cachedName = localStorage.getItem('userName');
        if (cachedName) {
            return { name: cachedName };
        }

        // If not in localStorage, try MongoDB
        const response = await fetch('/api/personal-info/name');
        const data = await response.json();

        if (data.value) {
            // Update localStorage
            localStorage.setItem('userName', data.value);
            return { name: data.value };
        }

        return null;
    } catch (error) {
        console.error('Error retrieving personal info:', error);
        return null;
    }
}


// =====================================================
// AUDIO HANDLING FUNCTIONS
// =====================================================

// Split text into chunks function
function splitTextIntoChunks(text, maxLength = 200) {
    // Split text into sentences, keeping the punctuation
    const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [text];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            if (sentence.length > maxLength) {
                // Split long sentences into words
                const words = sentence.split(/\s+/);
                for (const word of words) {
                    if (currentChunk.length + word.length > maxLength) {
                        chunks.push(currentChunk.trim());
                        currentChunk = '';
                    }
                    currentChunk += (currentChunk ? ' ' : '') + word;
                }
            } else {
                currentChunk = sentence;
            }
        } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}

// Populate voice list function
async function populateVoiceList() {
    try {
        const response = await fetch(`${SERVER_URL}/api/voices`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const voices = await response.json();

        if (!Array.isArray(voices) || voices.length === 0) {
            throw new Error('No voices received or invalid data format');
        }

        elements.voiceSelect.innerHTML = '<option value="">Default Voice</option>';
        let defaultVoice = null;

        const filteredVoices = voices.filter(voice => voice.Locale.startsWith('en-'));

        if (filteredVoices.length === 0) {
            throw new Error('No English voices found');
        }

        filteredVoices
            .sort((a, b) => a.LocaleName.localeCompare(b.LocaleName))
            .forEach((voice) => {
                const option = document.createElement('option');
                option.value = voice.ShortName;
                option.textContent = `${voice.LocaleName} - ${voice.DisplayName} (${voice.Gender}, ${voice.VoiceType})`;
                elements.voiceSelect.appendChild(option);

                if (voice.DisplayName === 'Andrew' &&
                    voice.Locale.startsWith('en-US') &&
                    voice.VoiceType === 'Neural') {
                    defaultVoice = voice.ShortName;
                }
            });

        if (defaultVoice) {
            elements.voiceSelect.value = defaultVoice;
            localStorage.setItem('selectedVoice', defaultVoice);
        }
    } catch (error) {
        console.error('Error fetching voices:', error);
        updateStatus(MESSAGES.ERRORS.CONNECTION);
        elements.voiceSelect.innerHTML = '<option value="">Error loading voices</option>';
    }
}

// Update the playAudio function
async function playAudio(text) {
    if (!text) return;

    try {
        state.isAISpeaking = true;
        state.isPlaying = true;
        updateStatus('AI is speaking...');
        elements.stopAudioButton.style.display = 'inline-block';  // Show the button

        // ... rest of playAudio function ...

    } catch (error) {
        console.error('Error playing audio:', error);
    } finally {
        state.isAISpeaking = false;
        state.isPlaying = false;
        elements.stopAudioButton.style.display = 'none';
        if (state.isConversationMode) {
            updateStatus(MESSAGES.STATUS.LISTENING);
        } else {
            updateStatus(MESSAGES.STATUS.READY);
        }
    }
}

// Simplify playNextInQueue function
async function playNextInQueue() {
    if (state.audioQueue.length === 0 || state.isPlaying || state.stopRequested) {
        return;
    }

    try {
        state.isPlaying = true;
        state.isAISpeaking = true;
        elements.stopAudioButton.style.display = 'block';
        updateStatus('AI is speaking...');

        const text = state.audioQueue.shift();
        console.log('Playing:', text);

        const response = await fetch(`${SERVER_URL}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                voice: elements.voiceSelect.value
            })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        state.currentAudio = new Audio(audioUrl);

        state.currentAudio.onended = () => {
            URL.revokeObjectURL(audioUrl);

            if (state.audioQueue.length > 0 && !state.stopRequested) {
                state.isPlaying = false;
                playNextInQueue();
            } else {
                console.log('Audio queue complete');
                state.isPlaying = false;
                state.isAISpeaking = false;
                elements.stopAudioButton.style.display = 'none';

                if (state.isConversationMode) {
                    updateStatus(MESSAGES.STATUS.LISTENING);
                    // Don't reset listening state, just start if needed
                    startListening();
                } else {
                    updateStatus(MESSAGES.STATUS.DEFAULT);
                }
            }
        };

        await state.currentAudio.play();

    } catch (error) {
        console.error('Error playing audio:', error);
        state.isPlaying = false;
        state.isAISpeaking = false;
        elements.stopAudioButton.style.display = 'none';
        if (state.isConversationMode) {
            // Don't reset listening state, just start if needed
            startListening();
        }
        updateStatus(state.isConversationMode ? MESSAGES.STATUS.LISTENING : MESSAGES.STATUS.DEFAULT);
    }
}

// Stop listening function
function stopListening() {
    console.log('Stopping listening');

    if (state.recognition) {
        try {
            state.recognition.stop();
            state.recognition = null;
        } catch (error) {
            console.error('Error stopping recognition:', error);
        }
    }

    state.isListening = false;
    console.log('Status: Ready');  // Only log to console
    if (state.isConversationMode) {
        updateStatus(MESSAGES.STATUS.LISTENING);
    } else {
        updateStatus(MESSAGES.STATUS.DEFAULT);
    }
    elements.micButton.textContent = '🎤';
}

// New helper function for safely starting listening
function safeStartListening() {
    if (state.isListening) {
        console.log('Already listening, skipping start');
        return;
    }

    if (!state.recognition) {
        console.log('Initializing new recognition instance');
        initializeSpeechRecognition();
    }

    try {
        console.log('Attempting to start recognition');
        state.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        initializeSpeechRecognition(); // Re-initialize with new instance
        state.recognition.start();
        elements.micButton.textContent = '🔴';
    } catch (error) {
        console.error('Failed to start recognition:', error);
        state.isListening = false;
        elements.micButton.textContent = '🎤';
        updateStatus(MESSAGES.ERRORS.CONNECTION);
    }
}

// Start listening function
function startListening() {
    console.log('Starting listening. Current state:', {
        isListening: state.isListening,
        isProcessing: state.isProcessing,
        isAISpeaking: state.isAISpeaking
    });

    if (state.isProcessing || state.isAISpeaking) {
        console.log('Cannot start listening while processing or speaking');
        return;
    }

    // Always create a fresh instance
    safeStartListening();
    state.lastAudioInput = Date.now();
    startInactivityTimer();
}

// Reset audio state function
function resetAudioState() {
    console.log('Resetting audio state. Current state:', {
        stopRequested: state.stopRequested,
        isPlaying: state.isPlaying,
        isAISpeaking: state.isAISpeaking,
        audioQueueLength: state.audioQueue.length
    });

    // Stop any current audio
    if (state.currentAudio) {
        state.currentAudio.pause();
        state.currentAudio = null;
    }

    state.stopRequested = false;
    state.isPlaying = false;
    state.isAISpeaking = false;
    state.audioQueue = [];

    console.log('Audio state reset. New state:', {
        stopRequested: state.stopRequested,
        isPlaying: state.isPlaying,
        isAISpeaking: state.isAISpeaking,
        audioQueueLength: state.audioQueue.length
    });
}

// Stop audio playback function
async function stopAudioPlayback() {
    try {
        state.stopRequested = true;
        state.audioQueue = [];

        if (state.currentAudio) {
            state.currentAudio.pause();
            state.currentAudio = null;
        }

        elements.stopAudioButton.style.display = 'none';
        state.isPlaying = false;  // Reset playing state
        state.isAISpeaking = false;  // Reset speaking state

        // Add a small delay before restarting listening
        await new Promise(resolve => setTimeout(resolve, 100));

        if (state.isConversationMode) {
            updateStatus(MESSAGES.STATUS.LISTENING);
            startListening();
        } else {
            updateStatus(MESSAGES.STATUS.DEFAULT);
        }

    } catch (error) {
        console.error('Error stopping audio:', error);
    } finally {
        state.stopRequested = false;  // Reset stop request flag
    }
}

// Add this new function
function handleFractions(text) {
    if (!text.includes('Ingredients:') && !text.includes('Instructions:')) {
        return text;
    }

    console.log('Before fraction replacement:', text);

    // Handle mixed numbers (whole + fraction) first
    text = text.replace(/(\d+)\s+(\d+\/\d+)/g, (match, whole, fraction) => {
        const fractions = {
            '3/4': 'three quarters',
            '1/4': 'quarter',
            '2/4': 'two quarters',
            '1/2': 'half',
            '2/3': 'two thirds',
            '1/3': 'third'
        };
        const fractionText = fractions[fraction] || fraction;
        return `${whole} and a ${fractionText}`;
    });

    // Handle standalone fractions
    text = text.replace(/(\d+)\/(\d+)/g, (match) => {
        const fractions = {
            '3/4': 'three quarters',
            '1/4': 'one quarter',
            '2/4': 'two quarters',
            '1/2': 'one half',
            '2/3': 'two thirds',
            '1/3': 'one third'
        };
        return fractions[match] || match;
    });

    // Handle single numbers
    text = text.replace(/\b4\b/g, 'four')
              .replace(/\b4th\b/g, 'fourth');

    console.log('After fraction replacement:', text);
    return text;
}

// Add this function to handle recipe text preprocessing
function preprocessRecipeText(text) {
    // Handle fractions
    text = text.replace(/(\d+)\/(\d+)/g, (match, num, den) => {
        const fractions = {
            '1/4': 'one quarter',
            '1/2': 'one half',
            '1/3': 'one third',
            '2/3': 'two thirds',
            '3/4': 'three quarters',
            '1/8': 'one eighth',
            '3/8': 'three eighths',
            '5/8': 'five eighths',
            '7/8': 'seven eighths'
        };
        return fractions[match] || `${num} ${den}ths`;
    });

    // Handle common recipe words and measurements
    const replacements = {
        'tbsp': 'tablespoon',
        'tsp': 'teaspoon',
        'oz': 'ounces',
        'lb': 'pounds',
        'pkg': 'package',
        'temp': 'temperature',
        'approx': 'approximately',
        'min': 'minutes',
        'hr': 'hours',
        'lg': 'large',
        'med': 'medium',
        'sm': 'small'
    };

    // Replace abbreviated measurements
    Object.entries(replacements).forEach(([abbr, full]) => {
        const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
        text = text.replace(regex, full);
    });

    return text;
}

// Then modify queueAudioChunk to use it
async function queueAudioChunk(text) {
    // Preprocess text if it looks like a recipe (contains ingredients or measurements)
    if (text.toLowerCase().includes('ingredients:') ||
        /\d+\s*(?:cup|tbsp|tsp|oz|lb|g|kg|ml|teaspoon|tablespoon)/i.test(text)) {
        text = preprocessRecipeText(text);
    }

    try {
        console.log('queueAudioChunk received:', text);


        // Preprocess text for better speech
        const processedText = preprocessTextForSpeech(text);
        console.log('Processed text:', processedText);

        // Handle fractions in recipe text
        text = handleFractions(text);

        if (!text || text.trim().length === 0) {
            console.log('Empty text, skipping audio queue');
            return;
        }

        state.stopRequested = false;
        state.audioQueue.push(text);
        console.log('Added to audio queue:', text);

        if (!state.isPlaying && !state.stopRequested) {
            await playNextInQueue();
        }
    } catch (error) {
        console.error('Error in queueAudioChunk:', error);
    }
}

// =====================================================
// INACTIVITY HANDLING FUNCTIONS
// =====================================================

// Inactivity timeout function
function startInactivityTimer() {
    clearInactivityTimer();

    if (state.isConversationMode) {
        console.log(`Starting inactivity timer for ${INTERVAL} minute(s)`);
        state.inactivityTimer = setTimeout(() => {
            if (state.isConversationMode) {
                console.log('Inactivity timeout reached');
                exitConversation(true);
            }
        }, CONVERSATION_INACTIVITY_TIMEOUT);

        // Add debug logging
        console.log('Timer set:', {
            interval: INTERVAL,
            timeout: CONVERSATION_INACTIVITY_TIMEOUT,
            currentTime: new Date().toISOString(),
            willTriggerAt: new Date(Date.now() + CONVERSATION_INACTIVITY_TIMEOUT).toISOString()
        });
    }
}

// Clear inactivity timer function
function clearInactivityTimer() {
    if (state.inactivityTimer) {
        console.log('Clearing inactivity timer');
        clearTimeout(state.inactivityTimer);
        state.inactivityTimer = null;
    }
}

// Format minutes plural function
function formatMinutesPlural(minutes) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

// =====================================================
// IMAGE HANDLING FUNCTIONS
// =====================================================

// Image request function
async function handleImageRequest(query) {
    try {
        const response = await fetch(`/api/google-image-search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.images) {
            // Display images directly without additional text
            displayImageResults(data.images);
        }
    } catch (error) {
        console.error('Error fetching images:', error);
    }
}

// Display image results function
function displayImageResults(images) {
    const messageElement = addMessageToChat('assistant', 'Here are some relevant images:');
    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-results-container';

    images.forEach(image => {
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'image-result';

        const img = document.createElement('img');
        img.src = image.thumbnail;
        img.alt = image.title;
        img.onclick = () => window.open(image.link, '_blank');

        imgWrapper.appendChild(img);
        imageContainer.appendChild(imgWrapper);
    });

    messageElement.querySelector('.message-content').appendChild(imageContainer);
}

// Image analysis function
async function handleImageAnalysis(imageData, prompt = '') {
    try {
        updateStatus('Analyzing image...');
        const startTime = Date.now();

        // Stop listening and prevent double responses
        if (state.isListening) {
            stopListening();
        }

        // Prevent the response from being treated as a new query
        state.isProcessing = true;
        state.isAISpeaking = true;

        // Create message element with correct initial metadata
        const messageElement = addMessageToChat('assistant', '', {
            model: 'gpt-4o',
            isImageAnalysis: true,
            startTime: startTime,
            tokenCount: 0
        });

        // Update initial metadata
        updateMetadata(messageElement, {
            model: 'gpt-4o',
            isImageAnalysis: true,
            metrics: {
                model: 'gpt-4o',
                startTime: startTime,
                tokenCount: 0
            }
        });

        // Disable recognition during analysis
        if (state.recognition) {
            state.recognition.abort();
            state.recognition = null;
        }

        const response = await fetch(`${SERVER_URL}/api/analyze-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: imageData,
                prompt: prompt || "What's in this image?",
                model: 'gpt-4o'  // Force correct model for image analysis
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let analysisText = '';
        let currentChunk = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.response) {
                            analysisText += data.response;
                            currentChunk += data.response;
                            updateMessageContent(messageElement, analysisText);

                            // Update metadata with each chunk
                            updateMetadata(messageElement, {
                                model: 'gpt-4o',
                                isImageAnalysis: true,
                                metrics: {
                                    model: 'gpt-4o',
                                    startTime: startTime,
                                    endTime: Date.now(),
                                    tokenCount: data.metrics?.totalTokens || data.metrics?.tokenCount || 0
                                }
                            });

                            // Queue audio for complete sentences
                            const sentences = currentChunk.match(/[^.!?]+[.!?]+/g);
                            if (sentences) {
                                queueAudioChunk(sentences.join(' '));
                                currentChunk = currentChunk.replace(sentences.join(''), '');
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing SSE data:', e);
                    }
                }
            }
        }

        // Queue any remaining text
        if (currentChunk.trim()) {
            queueAudioChunk(currentChunk.trim());
        }

        // Clear states after completion
        state.selectedImage = null;
        state.isProcessing = false;
        state.isAISpeaking = false;  // Reset speaking state

        // Wait a bit before potentially restarting listening
        await new Promise(resolve => setTimeout(resolve, 500));

        // Only restart listening if appropriate
        if (state.isConversationMode && !state.isAISpeaking && !state.isProcessing) {
            startListening();
        }

        updateStatus('Ready');

    } catch (error) {
        console.error('Error analyzing image:', error);
        updateStatus(MESSAGES.ERRORS.CONNECTION);
        throw error;
    }
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Clear any existing selected image state
            state.selectedImage = null;

            // Set the new image
            state.selectedImage = e.target.result;

            // Create a new user message with the image
            const messageElement = addMessageToChat('user', '', {
                type: 'text',
                messageType: 'text'
            });
            const imageElement = document.createElement('img');
            imageElement.src = state.selectedImage;
            imageElement.classList.add('uploaded-image');
            imageElement.style.cssText = 'max-width: 300px; border-radius: 8px; margin-top: 10px; cursor: pointer;';

            // Add click handler to open image in popup window with proper styling
            imageElement.onclick = function() {
                // Calculate center position
                const width = 700;
                const height = 700;
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;

                // Add position parameters to window.open
                const popup = window.open('', 'Image Preview',
                    `width=${width},height=${height},top=${top},left=${left}`);
                popup.document.write(`
                    <html>
                        <head>
                            <title>Image Preview</title>
                            <style>
                                body {
                                    margin: 0;
                                    padding: 20px;
                                    background: #000;
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                }
                                .close-btn {
                                    position: absolute;
                                    top: 10px;
                                    right: 10px;
                                    color: white;
                                    background: rgba(0,0,0,0.5);
                                    border: none;
                                    padding: 5px 10px;
                                    cursor: pointer;
                                    font-size: 18px;
                                    border-radius: 5px;
                                }
                                .close-btn:hover {
                                    background: rgba(0,0,0,0.8);
                                }
                                img {
                                    max-width: 650px;
                                    max-height: 700px;
                                    object-fit: contain;
                                    margin-top: 20px;
                                    background-repeat: no-repeat;
                                    background-position: center;
                                    display: block;
                                }
                            </style>
                        </head>
                        <body>
                            <button class="close-btn" onclick="window.close()">✕</button>
                            <img src="${this.src}" alt="Preview">
                        </body>
                    </html>
                `);
            };

            messageElement.querySelector('.message-content').appendChild(imageElement);

            // Focus input for description
            elements.userInput.focus();
            elements.userInput.placeholder = "Add a description or ask about the image...";
        };
        reader.readAsDataURL(file);
    }
}

// Search and display images function
async function searchAndDisplayImages(query) {
    try {
        const response = await fetch(`/api/google-image-search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error}`);
        }
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            return { images: data.items.map(item => ({ url: item.link, name: item.title })) };
        }
        return null;
    } catch (error) {
        console.error('Error searching images:', error);
        return null;
    }
}

// Insert and style images function
function insertAndStyleImages(images, messageElement) {
    const imageSection = `
        <div class="image-section" style="margin-top: 15px; border-top: 1px solid #ccc; padding-top: 10px;">
            <h3 style="font-size: 1.2em; margin-bottom: 10px; color: #333; font-weight: bold;">Images:</h3>
            <div class="image-container" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; max-width: 100%;">
                ${images.map(image => `
                    <a href="${image.link}" target="_blank" rel="noopener noreferrer" class="image-link"
                        style="cursor: pointer; text-decoration: none; display: block; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; transition: transform 0.2s ease-in-out; aspect-ratio: 1;">
                        <img src="${image.link}" alt="${image.title}" title="${image.title}"
                                style="width: 100%; height: 100%; object-fit: cover; display: block;">
                    </a>
                `).join('')}
            </div>
        </div>
    `;

    // Check if images section already exists
    const existingImageSection = messageElement.querySelector('.image-section');
    if (existingImageSection) {
        existingImageSection.remove();
    }

    messageElement.insertAdjacentHTML('beforeend', imageSection);

    // Add hover effects and error handling
    messageElement.querySelectorAll('.image-link').forEach(link => {
        link.onmouseover = () => link.style.transform = 'scale(1.05)';
        link.onmouseout = () => link.style.transform = 'scale(1)';

        // Add error handling for images
        const img = link.querySelector('img');
        img.onerror = () => {
            img.src = img.getAttribute('data-thumbnail') || 'path/to/fallback-image.jpg';
            console.log('Image failed to load, falling back to thumbnail:', img.src);
        };

        // Store thumbnail as backup
        if (image.thumbnail) {
            img.setAttribute('data-thumbnail', image.thumbnail);
        }
    });
}

// =====================================================
// DATE/TIME HANDLING FUNCTIONS
// =====================================================

// Rename fetchDateTime to fetchDateTimeData (handles data fetching)
async function fetchDateTimeData(timezone, type) {
    try {
        const response = await fetch('/api/datetime', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ timezone, type })  // Pass type to server
        });

        if (!response.ok) {
            throw new Error('Failed to fetch date/time');
        }

        const data = await response.json();
        console.log('DateTime data received:', data);
        return data;
    } catch (error) {
        console.error('Error fetching date/time:', error);
        throw error;
    }
}

// Rename checkDateTime to handleDateTimeResponse (handles UI and audio)
async function handleDateTimeResponse(type) {
    try {
        const timeData = await fetchDateTimeData(
            Intl.DateTimeFormat().resolvedOptions().timeZone,
            type
        );

        // Add messageType to the response data
        timeData.messageType = type;  // Add this line

        // Use SSE to send response
        if (state.eventSource && state.eventSource.readyState === EventSource.OPEN) {
            state.eventSource.dispatchEvent(new MessageEvent('message', {
                data: JSON.stringify(timeData)
            }));
        } else {
            // Fallback if SSE not available
            const messageElement = addMessageToChat('assistant', timeData.response, null, type);
        }
    } catch (error) {
        console.error('Error handling date/time:', error);
        addMessageToChat('error', 'Error: Failed to fetch date/time information');
    }
}

// Get time of day function
function getTimeOfDay() {
    const hour = new Date().getHours();

    if (hour < 12) {
        return 'morning';
    } else if (hour < 17) {
        return 'afternoon';
    } else {
        return 'evening';
    }
}

// =====================================================
// SPEECH RECOGNITION FUNCTIONS
// =====================================================

// Initialize speech recognition function
function initializeSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.error('Speech recognition not supported');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    state.recognition = new SpeechRecognition();
    state.recognition.continuous = false;
    state.recognition.interimResults = false;

    state.recognition.onstart = () => {
        console.log('Speech recognition started');
        state.isListening = true;
        updateStatus(MESSAGES.STATUS.LISTENING);
    };

    state.recognition.onerror = (event) => {
        console.log('Speech recognition error:', event.error);
        state.isListening = false;

        if (event.error === 'aborted') {
            console.log('Recognition aborted, not auto-restarting');
            return;
        }

        // updateStatus(`Error in speech recognition: ${event.error}`);
    };

    state.recognition.onend = () => {
        console.log('Speech recognition ended');
        state.isListening = false;

        if (state.isConversationMode && !state.isProcessing && !state.isAISpeaking && !state.stopRequested) {
            console.log('Scheduling restart of listening...');
            setTimeout(() => {
                if (!state.isListening && !state.isProcessing && !state.isAISpeaking && !state.stopRequested) {
                    console.log('Attempting to restart listening after delay');
                    safeStartListening();
                } else {
                    console.log('Conditions not met for restart:', {
                        isListening: state.isListening,
                        isProcessing: state.isProcessing,
                        isAISpeaking: state.isAISpeaking
                    });
                }
            }, 1000);
        }
    };

    state.recognition.onresult = handleSpeechResult;
}

// Toggle speech recognition function
function toggleSpeechRecognition() {
    console.log('toggleSpeechRecognition called, isListening:', state.isListening);
    if (state.isListening) {
        stopListening();
    } else {
        startListening();
    }
}

// Handle speech result function
async function handleSpeechResult(event) {
    if (!event.results || !event.results.length) {
        console.log('No speech detected');
        return;
    }

    const result = event.results[event.results.length - 1];
    if (!result.isFinal) {
        return;
    }

    const transcript = result[0].transcript.trim();
    console.log('Speech recognized:', transcript);

    // If we're in joke recording mode, send directly to joke handler
    if (handleMyJokes.state.isRecording) {
        console.log('In joke recording mode, handling:', transcript);
        await handleMyJokes.handleJokeRequest(transcript);
        return;
    }

    // Ignore input if AI is speaking (but not during joke recording)
    if (state.isAISpeaking && !handleMyJokes.state.isRecording) {
        console.log('Ignoring input during AI speech');
        return;
    }

    // Check if this is the AI's own response being echoed back
    if (isAIGreetingResponse(transcript) || state.isAISpeaking) {
        console.log('Detected AI response echo, ignoring:', transcript);
        return;
    }

    // Check for exit or quit commands
    if ((transcript.toLowerCase() === 'exit' || transcript.toLowerCase() === 'quit') && state.isConversationMode) {
        console.log('Exit command detected');
        addMessageToChat('user', transcript, {
            type: 'text',
            messageType: 'text'
        });
        exitConversation(false);
        return;
    }

    if (transcript) {
        // Check for joke commands first
        if (await handleMyJokes.handleJokeRequest(transcript)) {
            return;  // Stop if it was a joke command
        }

        elements.userInput.value = transcript;
        sendMessage(transcript);
    }
    state.lastAudioInput = Date.now();
    startInactivityTimer();
}

// Speech recognition error handler
function handleSpeechError(event) {
    console.error('Speech recognition error:', event.error);
    // Always restart listening in conversation mode
    if (state.isConversationMode) {
        startListening();
    }
}

// Add helper function to handle responses consistently
async function handleResponse(response) {
    if (state.selectedVoice) {
        try {
            await queueAudioChunk(response);
            state.isPlaying = false;
            await playNextInQueue();
        } catch (error) {
            console.error('Error playing audio response:', error);
        }
    }
}


// =====================================================
// RECIPE HANDLING FUNCTIONS
// =====================================================

window.printRecipe = async function(recipeText, messageElement) {
    try {
        // Call recipe endpoint to get formatted name
        const response = await fetch('/api/recipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: recipeText })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        const recipeName = data.recipe.name;

        // Get any images from the message
        const images = messageElement.querySelectorAll('.image-link img');
        const imageUrls = Array.from(images).map(img => img.src);

        // Split the recipe text into sections
        const sections = recipeText.split(/(?:ingredients:|instructions:|directions:)/i);

        // Get description (everything after the recipe name)
        const description = sections[0]
            .split('\n')[0]  // Get first line
            .substring(recipeName.length)  // Remove the recipe name part
            .replace(/^[^a-zA-Z]+/, '')  // Remove any leading non-letter characters
            .trim();

        const ingredients = sections[1] ? sections[1].trim().split(/\d+\./).filter(item => item.trim()) : [];
        const instructions = sections[2] ? sections[2].trim().split(/\d+\./).filter(item => item.trim()) : [];

        // Create print window first to ensure it's ready
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            throw new Error('Pop-up blocked. Please allow pop-ups and try again.');
        }

        // Create formatted HTML
        const formattedText = `
            <div class="recipe-intro">${description}</div>
            <h2>Ingredients</h2>
            <ul class="ingredients-list">
                ${ingredients.map(item => `<li>${item.trim()}</li>`).join('')}
            </ul>
            <h2>Instructions</h2>
            <ol class="instructions-list">
                ${instructions.map(item => `<li>${item.trim()}</li>`).join('')}
            </ol>
        `;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>${recipeName}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 40px;
                        }
                        h1 {
                            font-size: 24px;
                            margin-bottom: 20px;
                            border-bottom: 2px solid #333;
                            padding-bottom: 10px;
                            text-align: center;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }
                        h2 {
                            font-size: 20px;
                            margin: 20px 0 10px 0;
                            color: #444;
                        }
                        .recipe-intro {
                            font-style: italic;
                            margin-bottom: 20px;
                            color: #666;
                        }
                        .ingredients-list {
                            list-style-type: disc !important;
                            padding-left: 20px;
                            margin-bottom: 20px;
                        }
                        .ingredients-list li {
                            margin-bottom: 8px;
                            line-height: 1.4;
                            display: list-item !important;
                        }
                        .instructions-list {
                            padding-left: 20px;
                            margin-bottom: 20px;
                        }
                        .instructions-list li {
                            margin-bottom: 12px;
                            line-height: 1.6;
                        }
                        .image-section {
                            page-break-before: always;
                        }
                        .image-grid {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 10px;
                            margin: 5px 0;
                            max-width: 800px;
                        }
                        .image-grid img {
                            width: 100%;
                            height: 250px;
                            object-fit: cover;
                            border-radius: 8px;
                        }
                    </style>
                </head>
                <body>
                    <h1>${recipeName}</h1>
                    <div class="recipe-content">${formattedText}</div>
                    ${imageUrls.length ? `
                        <div class="image-section">
                            <h2 style="margin-bottom: 15px;">Recipe Images</h2>
                            <div class="image-grid">
                                ${imageUrls.map(url => `<img src="${url}" alt="Recipe Image">`).join('')}
                            </div>
                        </div>
                    ` : ''}
                </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 500);  // Give the browser time to load images

    } catch (error) {
        console.error('Error printing recipe:', error);
        updateStatus(MESSAGES.ERRORS.CONNECTION);
    }
};

// =====================================================
// PERSONAL INFO HANDLING FUNCTIONS
// =====================================================

// Store personal info function
async function storePersonalInfo(type, value) {
    try {
        const response = await fetch('/api/personal-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: window.sessionId,
                type: type,
                value: value
            })
        });

        if (!response.ok) throw new Error('Failed to store personal info');
        return await response.json();
    } catch (error) {
        console.error('Error storing personal info:', error);
    }
}

// Retrieve personal info function
async function retrievePersonalInfo(type) {
    try {
        const response = await fetch(`/api/personal-info/${type}?sessionId=${window.sessionId}`);
        if (!response.ok) throw new Error('Failed to retrieve personal info');
        return await response.json();
    } catch (error) {
        console.error('Error retrieving personal info:', error);
    }
}

// Add function to check if user's name is known
async function checkUserName() {
    try {
        // Try localStorage first
        const cachedName = localStorage.getItem('userName');
        if (cachedName) {
            return cachedName;
        }

        // If not in localStorage, try MongoDB
        const response = await retrievePersonalInfo('name');
        if (response && response.personalInfo && response.personalInfo.name) {
            // Update localStorage
            localStorage.setItem('userName', response.personalInfo.name);
            return response.personalInfo.name;
        }

        return null;
    } catch (error) {
        console.error('Error checking user name:', error);
        return null;
    }
}

// Add function to check stored information
async function checkStoredInfo(type) {
    try {
        // Check localStorage first
        const cachedValue = localStorage.getItem(`user_${type}`);
        if (cachedValue) {
            return cachedValue;
        }

        // If not in localStorage, check MongoDB
        const response = await retrievePersonalInfo(type);
        if (response?.personalInfo?.[type]) {
            localStorage.setItem(`user_${type}`, response.personalInfo[type]);
            return response.personalInfo[type];
        }
        return null;
    } catch (error) {
        console.error('Error checking stored info:', error);
        return null;
    }
}

// Categorize memory function
function categorizeMemory(text) {
    for (const [category, pattern] of Object.entries(MEMORY_CATEGORIES)) {
        if (pattern.test(text)) {
            return category;
        }
    }
    return 'general';
}

// Extract keywords function
function extractKeywords(text) {
    // Remove common words and punctuation
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but'];
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => !stopWords.includes(word));
}

// Extract time reference function
function extractTimeReference(text) {
    const timePatterns = {
        specific: /(?:at|on|during)\s+(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)/i,
        relative: /(?:tomorrow|next|in\s+\d+\s+(?:days?|weeks?|months?))/i,
        recurring: /(?:every|each)\s+(\w+)/i,
        date: /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/
    };

    for (const [type, pattern] of Object.entries(timePatterns)) {
        const match = text.match(pattern);
        if (match) {
            return {
                type,
                value: match[1] || match[0],
                original: match[0]
            };
        }
    }
    return null;
}

// Extract related terms function
function extractRelatedTerms(text) {
    const terms = [];

    // Extract people
    const peoplePattern = /(?:with|and|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
    let match;
    while ((match = peoplePattern.exec(text)) !== null) {
        terms.push({ type: 'person', value: match[1] });
    }

    // Extract places
    const placePattern = /(?:at|in|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;
    while ((match = placePattern.exec(text)) !== null) {
        terms.push({ type: 'place', value: match[1] });
    }

    return terms;
}

// Toggle conversation mode function
function toggleConversationMode(enable) {
    state.isConversationMode = enable;

    if (enable) {
        state.isAISpeaking = true;
        elements.stopAudioButton.style.display = 'block';
        addMessageToChat('system', MESSAGES.CONVERSATION.ENABLE);
        // Play enable message and ensure it completes before starting listening
        (async () => {
            try {
                await queueAudioChunk(MESSAGES.CONVERSATION.ENABLE);
                state.isAISpeaking = false;
                if (state.isConversationMode) {
                    updateStatus(MESSAGES.STATUS.LISTENING);
                    startListening();
                }
            } catch (error) {
                console.error('Error in conversation mode audio:', error);
                state.isAISpeaking = false;
                if (state.isConversationMode) {
                    updateStatus(MESSAGES.STATUS.LISTENING);
                    startListening();
                }
            }
        })();
    } else {
        stopListening();
        updateStatus(MESSAGES.CONVERSATION.DISABLE);
    }
}

// =====================================================
// JOKE HANDLING
// =====================================================

// joke prompt
const JOKE_PROMPT = `You are a helpful assistant who tells jokes.

When asked for a joke:
1. Provide a short, one-line joke that hasn't been told before
2. Keep it clean and family-friendly
3. Make it concise and easy to understand
4. No markdown or special formatting
`;

// Joke handling module
const handleMyJokes = {
    state: {
        isRecording: false,
        currentTitle: '',
        currentContent: '',
    },

    // Initialize joke handling
    init() {
        // Reset state
        this.resetState();
        // Any other initialization needed
    },

    // Reset state
    resetState() {
        this.state.isRecording = false;
        this.state.currentTitle = '';
        this.state.currentContent = '';
    },

    // Handle incoming messages
    async handleJokeRequest(messageText) {
        console.log('handleJokeRequest received:', messageText);

        // Get patterns first
        const patterns = getPatterns();
        console.log('Checking message against patterns');

        // If we're in any joke recording state, handle only joke-related responses
        if (this.state.isRecording) {
            console.log('In joke recording state:', this.state.isRecording);

            if (this.state.isRecording === 'waiting_for_title') {
                this.state.currentTitle = messageText;
                const confirmMessage = `Your joke will be titled "${messageText}". Is this correct? Say YES or NO.`;
                addMessageToChat('assistant', confirmMessage);
                await queueAudioChunk(confirmMessage);  // Use queueAudioChunk instead
                this.state.isRecording = 'confirming_title';
                updateStatus("Waiting for confirmation...");
                return true;
            }
        }

        // Check for list jokes commands using patterns
        const listJokeMatch = patterns.listJokes.find(pattern => pattern.test(messageText.toLowerCase()));
        if (listJokeMatch) {
            console.log('List jokes pattern matched:', listJokeMatch);
            addMessageToChat('user', messageText);
            const showAll = messageText.toLowerCase().includes('all jokes');
            await this.listJokes(showAll);
            return true;
        }

        // Check for save joke commands using patterns
        if (patterns.saveJoke.some(pattern => pattern.test(messageText))) {
            console.log('Detected save a joke command');
            addMessageToChat('user', messageText);

            const response = "Okay, what is the name of the joke you want to store?";
            addMessageToChat('assistant', response);  // Add message to chat first

            await queueAudioChunk(response);  // Use queueAudioChunk for consistent audio
            this.state.isRecording = 'waiting_for_title';
            updateStatus("Waiting for joke title...");
            if (state.isConversationMode) {
                stopListening();  // Stop listening while waiting for title
            }
            return true;
        }

        if (this.state.isRecording === 'waiting_for_title') {
            addMessageToChat('user', messageText);
            this.state.pendingTitle = messageText;
            const confirmMessage = `I heard "${messageText}". Is this the correct name for your joke? Say YES or NO.`;
            addMessageToChat('assistant', confirmMessage);  // Add message to chat first
            await speak(confirmMessage);  // Then speak it
            this.state.isRecording = 'confirming_title';
            updateStatus("Waiting for confirmation...");
            return true;
        }

        if (this.state.isRecording === 'confirming_title') {
            addMessageToChat('user', messageText);
            if (messageText.toLowerCase() === 'yes') {
                this.state.currentTitle = this.state.pendingTitle;
                const startMessage = "Okay, start telling your joke. Say COMPLETE when you're finished.";
                addMessageToChat('assistant', startMessage);  // Add message to chat first
                await speak(startMessage);  // Then speak it
                this.state.isRecording = 'recording';
                updateStatus("Recording your joke...");
            } else if (messageText.toLowerCase() === 'no') {
                const retryMessage = "Okay, what is the name of your joke?";
                addMessageToChat('assistant', retryMessage);  // Add message to chat first
                await speak(retryMessage);  // Then speak it
                this.state.isRecording = 'waiting_for_title';
                updateStatus("Waiting for joke title...");
            }
            return true;
        }

        if (this.state.isRecording === 'recording') {
            // If we're recording and the message isn't COMPLETE, just collect it
            if (messageText.toUpperCase() !== 'COMPLETE') {
                // Handle special pause commands for spoken jokes
                const pauseWords = ['PAUSE', 'WAIT', 'AHEM'];
                if (pauseWords.some(word => messageText.toUpperCase().includes(word))) {
                    this.state.currentContent += '... ';
                    return true;
                }

                // Add the new text to current content
                this.state.currentContent += messageText + ' ';
                addMessageToChat('user', messageText);
                return true;
            }

            // Only process COMPLETE when user is done telling the joke
            if (messageText.toUpperCase() === 'COMPLETE') {
                if (!this.state.currentContent.trim()) {
                    const errorMessage = "Your joke seems to be empty. Please tell your joke before saying COMPLETE.";
                    addMessageToChat('assistant', errorMessage);
                    await queueAudioChunk(errorMessage);
                    return true;
                }
                addMessageToChat('user', 'COMPLETE');
                updateStatus("Saving your joke...");
                await this.saveJoke();
                this.resetState();
                if (state.isConversationMode) {
                    updateStatus("Listening...");
                } else {
                    updateStatus(MESSAGES.STATUS.DEFAULT);
                }
                return true;
            }

            if (state.isConversationMode) {
                console.log('Restarting listening after joke handling');
                setTimeout(() => {
                    if (!state.isAISpeaking && !state.isProcessing) {
                        startListening();
                        updateStatus(MESSAGES.STATUS.LISTENING);
                    }
                }, 1000);
            }

            return true;
        }

        // Replace the existing joke retrieval section with this updated version
        if (messageText.toLowerCase().includes('tell me my joke about')) {
            try {
                console.log('Joke retrieval request detected');
                addMessageToChat('user', messageText);

                // Extract the joke title more accurately
                const jokeTitle = messageText
                    .toLowerCase()
                    .replace('tell me my joke about', '')
                    .trim();

                console.log('Searching for joke with title:', jokeTitle);

                // Temporarily stop listening while retrieving
                if (state.isConversationMode) {
                    stopListening();
                }

                await this.retrieveJoke(jokeTitle);

                // Restore conversation mode after a short delay
                if (state.isConversationMode) {
                    setTimeout(() => {
                        if (!state.isAISpeaking && !state.isProcessing) {
                            console.log('Restoring conversation mode after joke retrieval');
                            startListening();
                            updateStatus(MESSAGES.STATUS.LISTENING);
                        }
                    }, 1000);
                }

                return true;
            } catch (error) {
                console.error('Error in joke retrieval:', error);
                const errorMessage = "Sorry, there was an error retrieving your joke.";
                addMessageToChat('assistant', errorMessage);
                await queueAudioChunk(errorMessage);

                // Ensure conversation mode is restored even on error
                if (state.isConversationMode) {
                    setTimeout(() => {
                        startListening();
                        updateStatus(MESSAGES.STATUS.LISTENING);
                    }, 1000);
                }
                return true;
            }
        }

        if (messageText.toLowerCase() === 'yes' && sessionStorage.getItem('pendingJoke')) {
            try {
                let jokeData;
                try {
                    jokeData = JSON.parse(sessionStorage.getItem('pendingJoke'));
                } catch (error) {
                    console.error('Error parsing stored joke:', error);
                    throw new Error('Invalid stored joke data');
                }
                state.isAISpeaking = true;
                elements.stopAudioButton.style.display = 'block';
                addMessageToChat('assistant', jokeData.content);
                await queueAudioChunk(jokeData.content);
                sessionStorage.removeItem('pendingJoke');
            } catch (error) {
                console.error('Error playing joke:', error);
            } finally {
                state.isAISpeaking = false;
                elements.stopAudioButton.style.display = 'none';
                if (state.isConversationMode) {
                    updateStatus(MESSAGES.STATUS.LISTENING);
                    startListening();
                }
            }
            return true;
        }

        if (messageText.toLowerCase() === 'no' && sessionStorage.getItem('pendingJoke')) {
            const response = "Okay, your joke is stored for later retrieval.";
            state.isAISpeaking = true;
            elements.stopAudioButton.style.display = 'block';
            addMessageToChat('assistant', response);
            await queueAudioChunk(response);
            sessionStorage.removeItem('pendingJoke');
            state.isAISpeaking = false;
            elements.stopAudioButton.style.display = 'none';
            if (state.isConversationMode) {
                updateStatus(MESSAGES.STATUS.LISTENING);
                startListening();
            }
            return true;
        }

        if (messageText.toLowerCase().match(/^delete( my)? joke (?:about |called |titled )?(.+)$/i)) {
            const title = messageText.match(/^delete( my)? joke (?:about |called |titled )?(.+)$/i)[2];
            addMessageToChat('user', messageText);
            await this.confirmDelete(title);
            return true;
        }

        if (messageText.toLowerCase() === 'yes' && sessionStorage.getItem('pendingDelete')) {
            const title = sessionStorage.getItem('pendingDelete');
            await this.deleteJoke(title);
            sessionStorage.removeItem('pendingDelete');
            return true;
        }

        if (messageText.toLowerCase() === 'no' && sessionStorage.getItem('pendingDelete')) {
            const message = "Okay, I won't delete the joke.";
            addMessageToChat('assistant', message);
            await queueAudioChunk(message);
            sessionStorage.removeItem('pendingDelete');
            return true;
        }

        if (messageText.toLowerCase().match(/^update( my)? joke (?:about |called |titled )?(.+)$/i)) {
            const title = messageText.match(/^update( my)? joke (?:about |called |titled )?(.+)$/i)[2];
            addMessageToChat('user', messageText);
            this.state.isRecording = 'updating';
            this.state.currentTitle = title;
            speak("Okay, tell me the new version of your joke. Say COMPLETE when done");
            updateStatus("Recording updated joke...");
            this.state.currentContent = '';
            return true;
        }

        if (this.state.isRecording === 'updating') {
            if (messageText.toUpperCase() === 'COMPLETE') {
                if (!this.state.currentContent.trim()) {
                    const errorMessage = "The updated joke seems to be empty. Please tell the joke before saying COMPLETE.";
                    addMessageToChat('assistant', errorMessage);
                    await queueAudioChunk(errorMessage);
                    return true;
                }
                addMessageToChat('user', messageText);
                await this.updateJoke(this.state.currentTitle, this.state.currentContent);
                this.resetState();
                return true;
            }
            this.state.currentContent += messageText + ' ';
            addMessageToChat('user', messageText);
            return true;
        }

        if (messageText.toLowerCase().includes('search for') ||
            messageText.toLowerCase().includes('look up')) {
            try {
                const query = messageText.replace(/search for|look up/i, '').trim();
                const response = await fetch('/api/bing-search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query })
                });

                const data = await response.json();
                addMessageToChat('assistant', data.response);
                return;
            } catch (error) {
                console.error('Search error:', error);
            }
        }

        if (messageText.toLowerCase().match(/^search( my)? jokes? (?:for |about |containing )?(.+)$/i)) {
            const searchTerm = messageText.match(/^search( my)? jokes? (?:for |about |containing )?(.+)$/i)[2];
            addMessageToChat('user', messageText);
            await this.searchJokes(searchTerm);
            return true;
        }

        if (messageText.toLowerCase().match(/^delete joke id (\w+)$/i)) {
            const id = messageText.match(/^delete joke id (\w+)$/i)[1];
            addMessageToChat('user', messageText);
            const message = `Are you sure you want to delete joke with ID: ${id}? Say YES to confirm or NO to cancel.`;
            addMessageToChat('assistant', message);
            await queueAudioChunk(message);
            sessionStorage.setItem('pendingDelete', id);
            return true;
        }

        // // For regular joke requests
        // if (messageText.toLowerCase().includes('tell me a joke')) {
        //     addMessageToChat('user', messageText);
        //     state.isProcessing = true;
        //     state.isAISpeaking = false;
        //     updateStatus(MESSAGES.STATUS.PROCESSING);

        //     try {
        //         const response = await fetch('/api/chat', {
        //             method: 'POST',
        //             headers: { 'Content-Type': 'application/json' },
        //             body: JSON.stringify({
        //                 message: messageText,
        //                 history: [],
        //                 model: state.selectedModel,
        //                 systemPrompt: JOKE_PROMPT,   // Use the shorter joke-specific prompt
        //                 session: window.sessionId,
        //                 timezone: state.userTimezone
        //             })
        //         });

        //         if (!response.ok) throw new Error('Network response was not ok');

        //         // Reset states after response
        //         state.isProcessing = false;
        //         if (state.isConversationMode) {
        //             updateStatus(MESSAGES.STATUS.LISTENING);
        //             startListening();
        //         } else {
        //             updateStatus(MESSAGES.STATUS.DEFAULT);
        //         }
        //         return true;
        //     } catch (error) {
        //         console.error('Error in joke request:', error);
        //         // Reset states on error
        //         state.isProcessing = false;
        //         state.isAISpeaking = false;
        //         if (state.isConversationMode) {
        //             updateStatus(MESSAGES.STATUS.LISTENING);
        //             startListening();
        //         } else {
        //             updateStatus(MESSAGES.STATUS.DEFAULT);
        //         }
        //         return false;
        //     }
        // }

        return false; // Message wasn't joke-related
    },

    // Save joke to database
    async saveJoke() {
        try {
            const response = await fetch('/api/jokes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: this.state.currentTitle,
                    content: this.state.currentContent,
                    userId: window.sessionId  // Uses the persistent sessionId
                })
            });
            const data = await response.json();

            if (data.success) {
                const successMessage = `Great! I've saved your joke. To hear it later, just say 'tell me my joke about ${this.state.currentTitle}'`;
                addMessageToChat('assistant', successMessage);
                await queueAudioChunk(successMessage);
            } else {
                const errorMessage = "Sorry, I couldn't save your joke. Please try again.";
                addMessageToChat('assistant', errorMessage);
                await queueAudioChunk(errorMessage);
            }
        } catch (error) {
            console.error('Error saving joke:', error);
            const errorMessage = "Sorry, there was an error saving your joke.";
            addMessageToChat('assistant', errorMessage);
            await queueAudioChunk(errorMessage);
        } finally {
            if (state.isConversationMode) {
                updateStatus(MESSAGES.STATUS.LISTENING);
                setTimeout(() => {  // Add delay before starting to listen again
                    startListening();
                }, 1000);
            }
        }
    },

    // Retrieve joke from database
    async retrieveJoke(title) {
        try {
            console.log('Retrieving joke:', title);
            state.isAISpeaking = true;
            elements.stopAudioButton.style.display = 'block';

            const response = await fetch(`${SERVER_URL}/api/jokes/${encodeURIComponent(title)}?sessionId=${window.sessionId}`);
            const data = await response.json();

            console.log('Joke retrieval response:', data);

            if (data.success && data.joke) {
                const confirmMessage = "I found your joke. Would you like to hear it?";
                addMessageToChat('assistant', confirmMessage);
                await queueAudioChunk(confirmMessage);
                sessionStorage.setItem('pendingJoke', JSON.stringify(data.joke));
            } else {
                const notFoundMessage = "Sorry, I couldn't find a joke with that title.";
                addMessageToChat('assistant', notFoundMessage);
                await queueAudioChunk(notFoundMessage);
            }
        } catch (error) {
            console.error('Error retrieving joke:', error);
            const errorMessage = "Sorry, there was an error retrieving your joke.";
            addMessageToChat('assistant', errorMessage);
            await queueAudioChunk(errorMessage);
        } finally {
            state.isAISpeaking = false;
            elements.stopAudioButton.style.display = 'none';

            // Ensure conversation mode is properly restored
            if (state.isConversationMode) {
                updateStatus(MESSAGES.STATUS.LISTENING);
                startListening();
            }
        }
    },

    // Cleanup method
    cleanup() {
        this.resetState();
        sessionStorage.removeItem('pendingJoke');
    },

    // Add this new method to handleMyJokes
    async listJokes(showAll = false) {
        try {
            state.isAISpeaking = true;
            elements.stopAudioButton.style.display = 'block';

            // Get the persistent sessionId from localStorage
            const persistentSessionId = localStorage.getItem('persistentSessionId');

            console.log('\n━━━━━━ List Jokes Request ━━━━━━');
            console.log('Session details:', {
                showAll,
                persistentSessionId,
                windowSessionId: window.sessionId,
                localStorage: localStorage.getItem('persistentSessionId')
            });

            // Construct URL with proper query parameters
            let url;
            if (showAll) {
                url = '/api/jokes/list?view=all';
                console.log('Using all jokes URL:', url);
            } else {
                url = `/api/jokes/list?userId=${encodeURIComponent(persistentSessionId)}`;
                console.log('Using personal jokes URL:', url);
            }

            const response = await fetch(url);
            const data = await response.json();

            if (data.success && data.jokes.length > 0) {
                // Create header message
                const headerMessage = showAll ? "Here is a listing of ALL jokes:" : "Here is a listing of YOUR jokes:";
                addMessageToChat('assistant', headerMessage);
                await queueAudioChunk(headerMessage);

                // Format and display jokes
                const formattedJokes = data.jokes.map((joke, index) => ({
                    number: index + 1,
                    text: `"${joke.title}" (ID: ${joke._id})`
                }));
                displayJokes(formattedJokes);

                // Create speech text for jokes
                const jokesText = formattedJokes.map(joke =>
                    `${joke.number}. ${joke.text}`
                ).join('\n');
                await queueAudioChunk(jokesText);
            } else {
                const message = showAll ? "There are no jokes saved yet." : "You don't have any saved jokes yet.";
                addMessageToChat('assistant', message);
                await queueAudioChunk(message);
            }
        } catch (error) {
            console.error('Error listing jokes:', error);
            const errorMessage = "Sorry, there was an error retrieving your jokes.";
            addMessageToChat('assistant', errorMessage);
            await queueAudioChunk(errorMessage);
        } finally {
            state.isAISpeaking = false;
            elements.stopAudioButton.style.display = 'none';
            if (state.isConversationMode) {
                updateStatus(MESSAGES.STATUS.LISTENING);
                console.log('Continuing conversation after joke list:', {
                    isConversationMode: state.isConversationMode,
                    isListening: state.isListening
                });
            }
        }
    },

    // Add this new method to handleMyJokes
    async deleteJoke(title) {
        try {
            state.isAISpeaking = true;
            elements.stopAudioButton.style.display = 'block';
            // First get the joke to get its ID
            const getResponse = await fetch(`/api/jokes/${encodeURIComponent(title)}`);
            const getData = await getResponse.json();

            if (!getData.success) {
                throw new Error('Joke not found');
            }

            // Then delete using the ID
            const response = await fetch(
                `/api/jokes/${getData.joke.id}`,
                {
                    method: 'DELETE'
                }
            );
            const data = await response.json();

            if (data.success) {
                const message = `I've deleted your joke "${title}"`;
                addMessageToChat('assistant', message);
                await queueAudioChunk(message);
            } else {
                const message = "Sorry, I couldn't find that joke to delete.";
                addMessageToChat('assistant', message);
                await queueAudioChunk(message);
            }
        } catch (error) {
            console.error('Error deleting joke:', error);
            const errorMessage = "Sorry, there was an error deleting your joke.";
            addMessageToChat('assistant', errorMessage);
            await queueAudioChunk(errorMessage);
        } finally {
            state.isAISpeaking = false;
            elements.stopAudioButton.style.display = 'none';
            if (state.isConversationMode) {
                updateStatus(MESSAGES.STATUS.LISTENING);
                startListening();
            }
        }
    },

    // Add to handleMyJokes module
    async confirmDelete(title) {
        const message = `Are you sure you want to delete your joke "${title}"? Say YES to confirm or NO to cancel.`;
        addMessageToChat('assistant', message);
        await queueAudioChunk(message);
        sessionStorage.setItem('pendingDelete', title);
        return true;
    },

    // Add to handleMyJokes module
    async updateJoke(title, newContent) {
        try {
            state.isAISpeaking = true;
            elements.stopAudioButton.style.display = 'block';
            const response = await fetch(`/api/jokes/${encodeURIComponent(title)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: newContent,
                    userId: window.sessionId
                })
            });
            const data = await response.json();

            if (data.success) {
                const message = `I've updated your joke "${title}"`;
                addMessageToChat('assistant', message);
                await queueAudioChunk(message);
            } else {
                const message = "Sorry, I couldn't find that joke to update.";
                addMessageToChat('assistant', message);
                await queueAudioChunk(message);
            }
        } catch (error) {
            console.error('Error updating joke:', error);
            const errorMessage = "Sorry, there was an error updating your joke.";
            addMessageToChat('assistant', errorMessage);
            await queueAudioChunk(errorMessage);
        } finally {
            state.isAISpeaking = false;
            elements.stopAudioButton.style.display = 'none';
            if (state.isConversationMode) {
                updateStatus(MESSAGES.STATUS.LISTENING);
                startListening();
            }
        }
    },

    // Add to handleMyJokes module
    async searchJokes(searchTerm) {
        try {
            state.isAISpeaking = true;
            elements.stopAudioButton.style.display = 'block';
            const response = await fetch(`/api/jokes/search?term=${encodeURIComponent(searchTerm)}`);
            const data = await response.json();

            if (data.success && data.jokes.length > 0) {
                const message = `I found ${data.jokes.length} joke${data.jokes.length > 1 ? 's' : ''} containing "${searchTerm}". Would you like to hear them?`;
                addMessageToChat('assistant', message);
                await queueAudioChunk(message);
                sessionStorage.setItem('searchResults', JSON.stringify(data.jokes));
            } else {
                const message = `I couldn't find any jokes containing "${searchTerm}".`;
                addMessageToChat('assistant', message);
                await queueAudioChunk(message);
            }
        } catch (error) {
            console.error('Error searching jokes:', error);
            const errorMessage = "Sorry, there was an error searching your jokes.";
            addMessageToChat('assistant', errorMessage);
            await queueAudioChunk(errorMessage);
        } finally {
            state.isAISpeaking = false;
            elements.stopAudioButton.style.display = 'none';
            if (state.isConversationMode) {
                updateStatus(MESSAGES.STATUS.LISTENING);
                startListening();
            }
        }
    }
};

// Display jokes function
function displayJokes(jokes) {
    const jokeList = document.createElement('div');
    jokeList.className = 'joke-list';

    jokes.forEach(joke => {
        const jokeItem = document.createElement('div');
        jokeItem.className = 'joke-item';
        jokeItem.innerHTML = `
            <span class="joke-number">${joke.number}.</span>
            <span class="joke-text">${joke.text}</span>
        `;
        jokeList.appendChild(jokeItem);
    });

    addMessageToChat('system', jokeList.outerHTML);
}

// Add migration function
async function migrateJokes(fromUserId, toUserId) {
    try {
        const response = await fetch('/api/jokes/migrate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fromUserId, toUserId })
        });
        const data = await response.json();
        console.log('Joke migration result:', data);
    } catch (error) {
        console.error('Error migrating jokes:', error);
    }
}


// =====================================================
// YOUTUBE MODULE
// =====================================================

// Add this before handleMyJokes module
const handleYoutube = {
    isPlaying: false,

    async handleYoutubeRequest(messageText) {
        console.log('handleYoutubeRequest received:', messageText);
        const patterns = getPatterns();

        // Check for play request first
        const isPlay = patterns.youtube.playVideo.test(messageText);

        // Extract query by removing YouTube-related terms
        let query = messageText.toLowerCase()
            .replace(/youtube/i, '')
            .replace(/play/i, '')
            .replace(/search/i, '')
            .replace(/for/i, '')
            .replace(/videos?/i, '')
            .replace(/about/i, '')
            .trim();

        try {
            const response = await fetch('/api/youtube/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    type: isPlay ? 'play' : 'search'
                })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (isPlay && data.success && data.video) {
                this.showVideo(data.video.id);
                addMessageToChat('assistant', `Playing: ${data.video.title}`);
            } else if (data.success && data.videos) {
                const message = `Found these videos about "${query}":`;
                const videoList = `
                    <div class="youtube-results">
                        <ol class="video-list">
                            ${data.videos.map(video => `
                                <li class="video-item">
                                    <div class="video-title">${video.title}</div>
                                    <div class="video-controls">
                                        <a href="#" class="youtube-playHere-link" data-video-id="${video.id}">Play Here</a> |
                                        <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" class="youtube-link">YouTube</a>
                                        <div class="channel-info">By: ${video.channelTitle}</div>
                                    </div>
                                </li>
                            `).join('')}
                        </ol>
                    </div>`;

                // Add message with both text and video list
                addMessageToChat('assistant', message + '\n' + videoList, {
                    type: 'youtube-list',
                    messageType: 'youtube'
                });

                // Add click handlers
                setTimeout(() => {
                    document.querySelectorAll('.youtube-playHere-link').forEach(link => {
                        link.addEventListener('click', (e) => {
                            e.preventDefault();
                            const videoId = e.target.closest('.youtube-playHere-link').getAttribute('data-video-id');
                            this.showVideo(videoId);
                        });
                    });
                }, 100);
            }
            return true;
        } catch (error) {
            console.error('Error with YouTube request:', error);
            addMessageToChat('assistant', 'Sorry, there was an error processing your YouTube request.');
            return true;
        }
    },

    createVideoContainer() {
        if (!elements.videoContainer) {
            const container = document.createElement('div');
            container.id = 'youtube-container';
            container.className = 'youtube-container hidden';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'youtube-close-btn';
            closeBtn.innerHTML = '×';
            closeBtn.onclick = () => this.hideVideo();

            const videoWrapper = document.createElement('div');
            videoWrapper.id = 'youtube-video';
            videoWrapper.className = 'youtube-video';

            container.appendChild(closeBtn);
            container.appendChild(videoWrapper);
            document.body.appendChild(container);

            elements.videoContainer = container;
        }
    },

    showVideo(videoId) {
        this.createVideoContainer();
        const videoWrapper = document.getElementById('youtube-video');

        if (state.isListening) {
            stopListening();
        }
        this.isPlaying = true;

        videoWrapper.innerHTML = `
            <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/${videoId}?autoplay=1"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
            </iframe>`;
        elements.videoContainer.classList.remove('hidden');

        updateStatus('YouTube video is playing. Speech recognition is paused.');
    },

    hideVideo() {
        if (elements.videoContainer) {
            const videoWrapper = document.getElementById('youtube-video');
            videoWrapper.innerHTML = '';
            elements.videoContainer.classList.add('hidden');
            this.isPlaying = false;

            if (state.isConversationMode) {
                updateStatus(MESSAGES.CONVERSATION.STATUS);
                startListening();
            } else {
                updateStatus(MESSAGES.STATUS.DEFAULT);
            }
        }
    }
};


// =====================================================
// END OF app.js FILE v19.4-R-P-J-YT
// =====================================================