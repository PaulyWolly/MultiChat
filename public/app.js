/*
  APP.js
  Version: 20.0.0
  AppName: Multi-Chat [v20.0.0]
  Created by Paul Welby
  updated: January 4, 2025 @7:30PM
*/

// =====================================================
// GLOBAL SCOPED CONSTANTS
// =====================================================

// SERVER URL
const SERVER_URL = 'http://localhost:32000';

// Time constants
const INTERVAL = 5;  // Set timeout duration in minutes
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

// Add with other constants at the top
const RECIPE_PRINT_STYLES = `
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
        display: list-item !important;  /* Force list item display */
    }
    .instructions-list {
        padding-left: 20px;
        margin-bottom: 20px;
        counter-reset: item;  /* For proper numbering */
    }
    .instructions-list li {
        margin-bottom: 12px;
        line-height: 1.6;
        display: list-item !important;
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
`;

// Add at the top with other constants
const MIC_INITIALIZATION_DELAY = 4000;  // 4 seconds delay

// Add the MESSAGES constant
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
        RECIPE_NAME_IN_CAPS

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

document.addEventListener('DOMContentLoaded', initializeApp);

// =====================================================
// Initialize the app
// =====================================================

async function initializeApp() {
    console.log('Starting app initialization...');

    // Disable conversation mode toggle initially
    elements.conversationModeToggle.disabled = true;

    // Show startup message
    updateStatus(MESSAGES.STATUS.INITIALIZING);

    try {
        // Clear conversation state
        state.conversationHistory = [];
        elements.chatMessages.innerHTML = '';

        // Handle session management
        const currentTime = Date.now();
        const lastSessionTime = localStorage.getItem('sessionTimestamp');

        if (!lastSessionTime || (currentTime - parseInt(lastSessionTime)) > 24 * 60 * 60 * 1000) {
            localStorage.removeItem('sessionId');
            localStorage.removeItem('conversationHistory');
            localStorage.removeItem('sessionTimestamp');

            window.sessionId = `session-${currentTime}-${Math.random().toString(36).substring(2, 9)}`;
            localStorage.setItem('sessionId', window.sessionId);
            localStorage.setItem('sessionTimestamp', currentTime.toString());
        } else {
            window.sessionId = localStorage.getItem('sessionId');
        }

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

        // Set up SSE connection
        setupSSEConnection();

        // Update initial status
        // updateStatus('Click the microphone button to start speech recognition or type a message and press Send.');

        // Add delay before enabling conversation mode
        setTimeout(() => {
            elements.conversationModeToggle.disabled = false;
            updateStatus(MESSAGES.STATUS.DEFAULT);
        }, MIC_INITIALIZATION_DELAY);

        console.log('App initialization completed successfully');

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
        let welcomeMessage = userName
            ? `Conversation mode enabled. Good ${timeOfDay} ${userName}! Say "exit" when you'd like to end our chat.`
            : 'Conversation mode enabled. Say "exit" to end the conversation.';

        state.isProcessing = false;
        state.isSending = false;
        state.isAISpeaking = false;
        state.isListening = false;

        resetAudioState();
        startInactivityTimer();
        console.log('Inactivity timer started');
        updateStatus(welcomeMessage);
        startListening();
    } else {
        clearInactivityTimer();
        console.log('Inactivity timer cleared');
        updateStatus('Conversation mode disabled.');
        stopListening();
    }
}

// Add this function to handle SSE setup
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
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            state.sseRetryCount = 0;

            // Show "SSE Connected" briefly
            // updateStatus('SSE Connected');

            // Then switch to appropriate status after a short delay
            setTimeout(() => {
                if (state.isAISpeaking) {
                    console.log('Status: AI Speaking');
                    updateStatus('AI is speaking...');
                } else if (state.isConversationMode) {
                    console.log('Status: Listening');
                    updateStatus('Listening...');
                } else {
                    console.log('Status: Ready');
                    // updateStatus('Click the microphone button to start speech recognition, enable Conversation Mode, or type a message and press Send.');
                }
            }, 1000);
        };

        state.eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'heartbeat') {
                    console.log('Heartbeat received:', new Date(data.timestamp).toLocaleTimeString());
                }
                if (data.response) {
                    // Check for special message types
                    if (data.messageType === 'greeting') {  // Server sends 'greeting' type
                        addMessageToChat('assistant', data.response, null, 'greeting');
                    } else if (data.messageType === 'exit') {
                        addMessageToChat('assistant', data.response, null, 'exit');
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

                    // Queue audio if enabled
                    if (data.shouldPlayAudio && state.selectedVoice) {
                        queueAudioChunk(data.response);
                    }
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
        updateStatus('Connection error. Please refresh the page.');
    }
}


// Add cleanup for page unload
window.addEventListener('beforeunload', () => {
    if (state.eventSource) {
        state.eventSource.close();
    }
});


// GLOBAL HELPER/UTILTY FUNCTIONS

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
        updateStatus('Microphone permission denied. Please enable it in your browser settings.');
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
    const startTime = Date.now();

    // First, check if this is a web search request
    const isWebSearch = messageText.toLowerCase().match(/^(show me |do |get |find )?(a |the )?(web |bing |internet )?search for (.*)/i);

    if (isWebSearch) {
        try {
            const requestStartTime = Date.now();  // Track request start time
            const query = isWebSearch[4].trim();
            addMessageToChat('user', messageText);

            const response = await fetch('/api/bing-search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });

            const data = await response.json();
            const messageElement = addMessageToChat('assistant', data.response);

            // Use server's duration if available, otherwise calculate client-side
            const requestDuration = data.metrics?.duration ||
                `${((Date.now() - requestStartTime) / 1000).toFixed(2)}s`;

            updateMetadata(messageElement, {
                model: 'bing-search',
                metrics: {
                    model: 'bing-search',
                    totalTokens: data.response.length,
                    startTime: data.metrics.startTime || requestStartTime,
                    endTime: data.metrics.endTime || Date.now(),
                    duration: requestDuration
                }
            });
            return;
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    // Check if this is a search query
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

    // Check for name-related queries first
    const nameQuery = messageText.match(/what(?:'s| is) my name/i);
    if (nameQuery) {
        try {
            addMessageToChat('user', messageText);
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
                const messageElement = addMessageToChat('assistant', response);
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
            addMessageToChat('user', messageText);

            const name = nameSet[1].trim();
            // Store in both localStorage and MongoDB
            localStorage.setItem('user_name', name);
            await storePersonalInfo('name', name);

            const response = `I'll remember that your name is ${name}`;
            const messageElement = addMessageToChat('assistant', response);
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
                addMessageToChat('user', messageText);
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
                const messageElement = addMessageToChat('assistant', response);
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
                addMessageToChat('user', messageText);
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
                    const messageElement = addMessageToChat('assistant', response);
                    const endTime = Date.now();
                    const durationInSeconds = Math.max(0.01, ((endTime - startTime) / 1000)).toFixed(2);  // Minimum 0.01s

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
                const messageElement = addMessageToChat('assistant', noValueResponse);
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
    }

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
        updateStatus('Connection error. Please try again.');

        // Clean up and reset states
        resetAudioState();
        if (state.isConversationMode) {
            startInactivityTimer();
            startListening();
        }
    };

    state.eventSource.onmessage = function(event) {
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
                    addMessageToChat('assistant', data.response, null, 'greeting');
                } else if (data.messageType === 'exit') {
                    addMessageToChat('assistant', data.response, null, 'exit');
                } else if (data.messageType === 'system' || data.messageType === 'time' || data.messageType === 'date' || data.messageType === 'datetime') {  // Using 'datetime' here too
                    addMessageToChat('assistant', data.response, null, data.messageType);  // Pass the actual type
                } else {
                    // Regular message handling
                    const messageElement = addMessageToChat('assistant', data.response, {
                        model: data.metrics?.model,
                        startTime: startTime,
                        tokenCount: data.tokenCount
                    });
                }

                // Queue audio if enabled
                if (data.shouldPlayAudio && state.selectedVoice) {
                    queueAudioChunk(data.response);
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
                addMessageToChat('user', messageText);
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
                addMessageToChat('user', messageText);
                exitConversation(false);
                return;
            }

            // Check for greetings before adding user message
            const isGreeting = /^(hi|hi\s+there|hello|hello\s+there|hey|hey\s+there|greetings)$/i.test(messageText.trim());

            if (isGreeting) {
                try {
                    addMessageToChat('user', messageText);
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
                    let greeting = userName
                        ? `Good ${timeOfDay} ${userName}! It's nice to chat with you again. How may I be of assistance to you today?`
                        : `Good ${timeOfDay}! How can I assist you today?`;

                    resetAudioState();
                    const messageElement = addMessageToChat('assistant', greeting, null, 'greeting');
                    const endTime = Date.now();

                    // Add metadata for greeting
                    updateMetadata(messageElement, {
                        model: 'greeting',
                        metrics: {
                            model: 'greeting',
                            totalTokens: greeting.length,
                            startTime: startTime,
                            endTime: endTime,
                            durationInSeconds: ((endTime - startTime) / 1000).toFixed(2)
                        },
                        startTime: startTime,
                        endTime: endTime
                    });

                    try {
                        await queueAudioChunk(greeting);
                        await playNextInQueue();
                    } catch (error) {
                        console.error('Audio playback error:', error);
                    }

                    return;
                } catch (error) {
                    console.error('Error in greeting:', error);
                }
            }

            // For all other messages, add user message before processing
            addMessageToChat('user', messageText);

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

                // const messageElement = addMessageToChat('assistant', response);
                addMessageToChat('assistant', response);

                // Queue audio for date/time response
                await queueAudioChunk(response);

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

                console.log('Queueing audio for response:', response.response);
            } catch (error) {
                console.error(`Error getting AI response:`, error);
                updateStatus('Error: ' + error.message);
                addMessageToChat('error', `Error: ${error.message}`);
            } finally {
                state.isProcessing = false;
                state.isSending = false;
                // updateStatus('Ready');
                console.log('Ready');
                elements.processingIndicator.style.display = 'none';
                if (state.isConversationMode && !state.isAISpeaking) {
                    startListening();
                }
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
        console.log('Ready');
        // updateStatus('Ready');
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
            session: sessionId, // Include sessionId in the request
            timezone: state.userTimezone  // Add timezone to request
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

                    // Queue audio for complete sentences
                    const sentences = currentChunk.match(/[^.!?]+[.!?]+/g);
                    if (sentences) {
                        queueAudioChunk(sentences.join(' '));
                        currentChunk = currentChunk.replace(sentences.join(''), '');
                    }
                }
                if (data.done) {
                    if (currentChunk) queueAudioChunk(currentChunk.trim());
                    state.isRendering = false;
                    if (!state.isAISpeaking) {
                        // updateStatus('Ready');
                        console.log('Ready');
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
function addMessageToChat(role, content, imageUrl = null, type = null) {
    const messageDiv = document.createElement('div');
    let classList = ['message', role];

    if (type === 'greeting') {
        classList.push('greeting-bubble');
    } else if (type === 'exit') {
        classList.push('exit-bubble');
    } else if (type === 'system' || type === 'time' || type === 'date' || type === 'datetime') {
        classList.push('system-bubble');
    }
    messageDiv.className = classList.join(' ');

    // Only add metadata for regular assistant messages
    if (role === 'assistant' && !type) {  // No metadata for greeting/exit/system/time/date/datetime
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'metadata';
        messageDiv.appendChild(metadataDiv);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Check if this is a Bing search result and use marked for rendering
    if (type === 'bing-search' || content.includes('# Web Results') || content.includes('# News Results')) {
        contentDiv.innerHTML = marked.parse(content);
        contentDiv.classList.add('search-results');
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
    console.log(`Exiting conversation. Timeout: ${isTimeout}`);

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

        const exitMessage = isTimeout
            ? MESSAGES.CLOSINGS.TIMEOUT(INTERVAL)
            : MESSAGES.CLOSINGS.EXIT;

        // Use addMessageToChat with 'exit' message type
        const messageElement = addMessageToChat('assistant', exitMessage, null, 'exit');
        messageElement.classList.add('exit-bubble');

        // Queue the exit message for speech as a single chunk
        console.log('Queueing complete exit message for speech');
        state.isAISpeaking = true;
        updateStatus(MESSAGES.STATUS.SPEAKING);
        elements.stopAudioButton.style.display = 'inline-block';

        // Queue the entire message as one piece
        state.audioQueue = [exitMessage];
        if (!state.isPlaying) {
            await playNextInQueue();
        }

        // Reset conversation mode
        elements.conversationModeToggle.checked = false;
        state.isConversationMode = false;
        elements.conversationStatus.innerHTML = '';

    } catch (error) {
        console.error('Error in exitConversation:', error);
        stopListening();
        elements.conversationModeToggle.checked = false;
        state.isConversationMode = false;
        updateStatus(MESSAGES.ERRORS.EXIT);
    }
}

// Update status function
function updateStatus(message) {
    elements.status.textContent = message;

    // Update conversation status separately
    if (state.isConversationMode) {
        elements.conversationStatus.innerHTML = 'Conversation Mode is enabled.<br>Say "exit" to end conversation';
    } else {
        elements.conversationStatus.textContent = '';
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
        updateStatus('Failed to load voice options: ' + error.message);
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
            updateStatus('Listening...');
        } else {
            // updateStatus('Ready');
            console.log('Ready');
        }
    }
}

// Update the playNextInQueue function
async function playNextInQueue() {
    console.log('playNextInQueue called. Queue length:', state.audioQueue.length);
    if (state.audioQueue.length === 0 || state.isPlaying || state.stopRequested) {
        return;
    }

    state.isPlaying = true;
    state.isAISpeaking = true;
    elements.stopAudioButton.style.display = 'inline-block';  // Show the button
    updateStatus('AI is speaking...');

    // Ensure we stop listening before playing audio
    if (state.isListening) {
        stopListening();
    }

    const text = state.audioQueue.shift();

    try {
        console.log('Fetching audio from TTS API');
        const response = await fetchWithRetry(`${SERVER_URL}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text.trim(),
                voice: elements.voiceSelect.value
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        state.currentAudio = new Audio(audioUrl);

        state.currentAudio.onended = () => {
            console.log('Audio playback ended');
            URL.revokeObjectURL(audioUrl);
            state.isPlaying = false;
            state.isAISpeaking = false;
            elements.stopAudioButton.style.display = 'none';  // Hide the button

            if (state.audioQueue.length > 0 && !state.stopRequested) {
                playNextInQueue();
            } else {
                // Update status based on conversation mode
                updateStatus(state.isConversationMode ? MESSAGES.STATUS.LISTENING : MESSAGES.STATUS.DEFAULT);

                if (state.isConversationMode && !state.isProcessing) {
                    setTimeout(() => {
                        initializeSpeechRecognition();
                        startListening();
                    }, 500);
                }
            }
        };

        await state.currentAudio.play();

    } catch (error) {
        console.error('Error in text-to-speech:', error);
        state.isPlaying = false;
        state.isAISpeaking = false;
        elements.stopAudioButton.style.display = 'none';  // Hide the button
        updateStatus('Error in text-to-speech');

        if (state.audioQueue.length > 0) {
            setTimeout(() => playNextInQueue(), 1000);
        }
    }
}

// Stop listening function
function stopListening() {
    console.log('Stopping listening');

    if (state.recognition) {
        try {
            state.recognition.stop();
            state.recognition = null; // Clear the instance
        } catch (error) {
            console.error('Error stopping recognition:', error);
        }
    }

    state.isListening = false;
    // updateStatus('Ready');
    console.log('Ready');
    elements.micButton.textContent = '🎤';
    if (state.inactivityTimer) {
        clearTimeout(state.inactivityTimer);
        state.inactivityTimer = null;
    }
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
        updateStatus('Error starting speech recognition');
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
function stopAudioPlayback() {
    console.log('Stopping audio playback');
    state.stopRequested = true;
    state.audioQueue = [];
    console.log('Audio queue cleared');

    if (state.currentAudio) {
        state.currentAudio.pause();
        state.currentAudio.currentTime = 0;
        state.currentAudio = null;
        console.log('Current audio stopped and reset');
    }

    state.isPlaying = false;
    state.isAISpeaking = false;
    elements.stopAudioButton.style.display = 'none';

    // Update status based on conversation mode
    if (state.isConversationMode) {
        updateStatus('Listening...');
    } else {
        // updateStatus('Ready');
        console.log('Ready');
    }

    // Reset stopRequested after a short delay
    setTimeout(() => {
        state.stopRequested = false;
        if (state.isConversationMode && !state.isListening && !state.isRendering) {
            startListening();
        }
    }, 100);
}

// Queue audio chunk function
async function queueAudioChunk(text) {
    console.log('Queueing audio chunk:', text);

    if (!text || text.trim().length === 0) {
        console.log('Empty text, skipping audio queue');
        return;
    }

    // Strip markdown before queuing for audio
    const cleanText = stripMarkdown(text);

    // Split text into sentences more reliably
    const sentences = cleanText
        .split(/(?<=[.!?])\s+/)  // Split on sentence endings only
        .filter(Boolean)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    // Check if it's a story (has multiple paragraphs)
    if (text.includes('\n\n')) {
        state.stopRequested = false;
        // Add each sentence to the queue
        sentences.forEach(sentence => {
            if (!state.audioQueue.includes(sentence)) {
                state.audioQueue.push(sentence);
            }
        });
        console.log('Story detected, using sentence chunks:', sentences);
    } else if (text.startsWith('🔍 Bing Search Results')) {
        state.stopRequested = false;
        const chunks = text.split('\n').filter(line => line.trim().length > 0);
        state.audioQueue = chunks;
        console.log('Bing search results detected, using multiple chunks:', chunks);
    } else if (text.toLowerCase().includes('date') || text.toLowerCase().includes('time')) {
        state.stopRequested = false;
        state.audioQueue = [cleanText];
        console.log('DateTime query detected, using single chunk:', cleanText);
    } else {
        sentences.forEach(sentence => {
            if (!state.audioQueue.includes(sentence)) {
                state.audioQueue.push(sentence);
            }
        });
    }

    console.log('Audio queue length:', state.audioQueue.length);
    console.log('Audio queue contents:', state.audioQueue);
    console.log('Current state:', {
        isPlaying: state.isPlaying,
        stopRequested: state.stopRequested,
        isAISpeaking: state.isAISpeaking
    });

    if (!state.isPlaying && !state.stopRequested) {
        console.log('Starting playback from queueAudioChunk');
        await playNextInQueue();
    } else {
        console.log('Not starting playback. isPlaying:', state.isPlaying, 'stopRequested:', state.stopRequested);
    }
}

// Play next in queue function
async function playNextInQueue() {
    console.log('playNextInQueue called. Queue length:', state.audioQueue.length);
    if (state.audioQueue.length === 0 || state.isPlaying || state.stopRequested) {
        return;
    }

    state.isPlaying = true;
    state.isAISpeaking = true;
    elements.stopAudioButton.style.display = 'inline-block';  // Show the button
    updateStatus('AI is speaking...');

    // Ensure we stop listening before playing audio
    if (state.isListening) {
        stopListening();
    }

    const text = state.audioQueue.shift();

    try {
        console.log('Fetching audio from TTS API');
        const response = await fetchWithRetry(`${SERVER_URL}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text.trim(),
                voice: elements.voiceSelect.value
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        state.currentAudio = new Audio(audioUrl);

        state.currentAudio.onended = () => {
            console.log('Audio playback ended');
            URL.revokeObjectURL(audioUrl);
            state.isPlaying = false;
            state.isAISpeaking = false;
            elements.stopAudioButton.style.display = 'none';  // Hide the button

            if (state.audioQueue.length > 0 && !state.stopRequested) {
                playNextInQueue();
            } else {
                // Update status based on conversation mode
                updateStatus(state.isConversationMode ? MESSAGES.STATUS.LISTENING : MESSAGES.STATUS.DEFAULT);

                if (state.isConversationMode && !state.isProcessing) {
                    setTimeout(() => {
                        initializeSpeechRecognition();
                        startListening();
                    }, 500);
                }
            }
        };

        await state.currentAudio.play();

    } catch (error) {
        console.error('Error in text-to-speech:', error);
        state.isPlaying = false;
        state.isAISpeaking = false;
        elements.stopAudioButton.style.display = 'none';  // Hide the button
        updateStatus('Error in text-to-speech');

        if (state.audioQueue.length > 0) {
            setTimeout(() => playNextInQueue(), 1000);
        }
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

        // Create message element with correct initial metadata
        const messageElement = addMessageToChat('assistant', '', {
            model: 'gpt-4o',
            isImageAnalysis: true,
            startTime: startTime,
            tokenCount: 0
        });

        const response = await fetch(`${SERVER_URL}/api/analyze-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: imageData,
                prompt: prompt
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

                            if (data.metrics) {
                                const updatedMetrics = {
                                    ...data.metrics,
                                    model: 'gpt-4o',
                                    isImageAnalysis: true,
                                    startTime: startTime,
                                    endTime: Date.now(),
                                    tokenCount: data.metrics.totalTokens || data.metrics.tokenCount || 0
                                };
                                console.log('Updating metrics:', updatedMetrics);
                                updateMetadata(messageElement, updatedMetrics);
                            }

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

        // updateStatus('Ready');
        console.log('Ready');
    } catch (error) {
        console.error('Error analyzing image:', error);
        updateStatus('Error analyzing image');
        throw error;
    }
}

// Handle image upload function
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
            const messageElement = addMessageToChat('user', '');
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
        updateStatus('Listening...');
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
function handleSpeechResult(event) {
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

    // Check for exit or quit commands
    if ((transcript.toLowerCase() === 'exit' || transcript.toLowerCase() === 'quit') && state.isConversationMode) {
        console.log('Exit command detected');
        addMessageToChat('user', transcript);  // Add user's exit command to chat
        exitConversation(false);  // false indicates this is a manual exit, not a timeout
        return;
    }

    if (transcript) {
        elements.userInput.value = transcript;
        sendMessage(transcript);
    }
    state.lastAudioInput = Date.now();
    startInactivityTimer();
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
    }  // <-- Add this closing brace
}

// =====================================================
// RECIPE HANDLING FUNCTIONS
// =====================================================

window.printRecipe = function(recipeText, messageElement) {
    console.log('Recipe text received:', recipeText);

    // Get any images from the message
    const images = messageElement.querySelectorAll('.image-link img');
    const imageUrls = Array.from(images).map(img => img.src);

    // Split the recipe text into sections
    const sections = recipeText.split(/(?:ingredients:|instructions:|directions:)/i);

    // Format each section
    const intro = sections[0].trim();
    const recipeName = intro.match(/(?:recipe for|RECIPE_NAME_IN_CAPS:)\s*(.*?)(?::|\.|\n|$)/i)?.[1]?.trim() || 'Recipe';

    const ingredients = sections[1] ? sections[1].trim().split(/\d+\./).filter(item => item.trim()) : [];
    const instructions = sections[2] ? sections[2].trim().split(/\d+\./).filter(item => item.trim()) : [];

    // Create formatted HTML
    const formattedText = `
        <div class="recipe-intro">${intro}</div>

        <h2>Ingredients</h2>
        <ul class="ingredients-list">  // Bullet points for ingredients
            ${ingredients.map(item => `<li>${item.trim()}</li>`).join('')}
        </ul>

        <h2>Instructions</h2>
        <ol class="instructions-list">  // Numbers for instructions
            ${instructions.map(item => `<li>${item.trim()}</li>`).join('')}
        </ol>
    `;

    // Create print window with the same styling
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>${recipeName.toUpperCase()}</title>
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
                        page-break-before: always;  /* Force images to start on new page */
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
    printWindow.print();
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



// =====================================================
// END OF FILE v19.4.3
// =====================================================