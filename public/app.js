/*
  APP.js
  Version: 20.0.1
  AppName: Multi-Chat [v20.0.1]
  Created by Paul Welby
  Updated: January 6, 2025 @7:00AM
*/

// =====================================================
// GLOBAL SCOPED CONSTANTS
// =====================================================

// SERVER URL
const SERVER_URL = 'http://localhost:32001';

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


// Add at the top with other constants
const MIC_INITIALIZATION_DELAY = 4000;  // 4 seconds delay

// Add the MESSAGES constant
const MESSAGES = {
    STATUS: {
        DEFAULT: "Click the Conversation Mode checkbox, or press the microphone button \n...to enable conversations, or enter a message and press Send",
        LISTENING: "Listening...",
        SPEAKING: "AI is speaking...",
        PROCESSING: "Processing...",
        READY: "Ready",
        ERROR: "Error occurred. Please refresh the page if issues persist.",
        INITIALIZING: "Initializing app...",
        VIDEO_PLAYING: 'Video playing...'
    },
    CONVERSATION: {
        ENABLE: "Conversation Mode is now enabled. You can speak freely \n ...and say 'exit' when you want to end the conversation.",
        DISABLE: "Conversation Mode has been disabled. You can still type messages or click the microphone button for single responses.",
        EXIT: 'Conversation ended'
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
    savingJoke: false,
    pendingNameChange: null,
    lastRequestTime: Date.now()
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
// HELPER FUNCTIONS
// =====================================================

function isRecipe(text) {
    // Check if text contains both "Ingredients:" and "Instructions:" or "Directions:"
    return text.includes('Ingredients:') &&
           (text.includes('Instructions:') || text.includes('Directions:'));
}

async function handleCommand(text) {
    // Set lastRequestTime for non-system commands
    if (!text.match(/^(what time|what date|what.*date.*time|hi|hello|hey|bye|goodbye|exit|quit)/i)) {
        state.lastRequestTime = Date.now();
    }

    const patterns = getPatterns();

    // Check for remember info command first
    for (const pattern of patterns.rememberInfo) {
        const match = text.match(pattern);
        if (match) {
            const [_, key, value] = match;
            const info = `${key} is ${value}`;
            await storePersonalInfo(info);
            return true;
        }
    }

    // Check for greetings
    for (const pattern of patterns.greetings) {
        if (pattern.test(text)) {
            const response = generateGreeting();
            state.isAISpeaking = true;
            elements.stopAudioButton.style.display = 'block';
            addMessageToChat('assistant', response, { type: 'greeting' });
            await queueAudioChunk(response);
            state.isAISpeaking = false;
            elements.stopAudioButton.style.display = 'none';
            return true;
        }
    }

    // FIRST: Check if we're waiting for a name change confirmation
    if (state.pendingNameChange) {
        state.isAISpeaking = true;
        elements.stopAudioButton.style.display = 'block';
        state.lastRequestTime = Date.now();

        const response = text.trim().toLowerCase();
        const currentName = localStorage.getItem('stored_name');
        let message;

        if (response === 'yes') {
            message = `I've updated your name from "${currentName}" to "${state.pendingNameChange}".`;
            localStorage.setItem('stored_name', state.pendingNameChange);
            state.pendingNameChange = null;
        } else if (response === 'no') {
            message = `Okay, I'll keep your name as "${currentName}".`;
            state.pendingNameChange = null;
        } else {
            message = `Please respond with "yes" or "no" - would you like to change your name from "${currentName}" to "${state.pendingNameChange}"?`;
        }

        addMessageToChat('assistant', message, { showMetadata: true });
        await queueAudioChunk(message);
        state.isAISpeaking = false;
        elements.stopAudioButton.style.display = 'none';
        return true;
    }

    // THEN: Check for name storage command
    for (const pattern of patterns.storeName) {
        const match = text.match(pattern);
        if (match) {
            const newName = match[1].trim();
            const existingName = localStorage.getItem('stored_name');

            state.isAISpeaking = true;
            elements.stopAudioButton.style.display = 'block';
            state.lastRequestTime = Date.now();

            if (existingName) {
                // Ask for confirmation if name exists
                state.pendingNameChange = newName;
                const message = `I see you want to change your name from "${existingName}" to "${newName}".\nTo protect your stored name, please respond with "yes" to confirm the change, or "no" to keep it as "${existingName}".`;
                addMessageToChat('assistant', message, { showMetadata: true });
                await queueAudioChunk(message);
            } else {
                // Only store without confirmation if no name exists
                const message = `I'll remember that your name is ${newName}.`;
                localStorage.setItem('stored_name', newName);
                addMessageToChat('assistant', message, { showMetadata: true });
                await queueAudioChunk(message);
            }

            state.isAISpeaking = false;
            elements.stopAudioButton.style.display = 'none';
            return true;
        }
    }

    // Check for name query first
    for (const pattern of patterns.getName) {
        if (pattern.test(text)) {
            const storedName = localStorage.getItem('stored_name');
            state.isAISpeaking = true;
            elements.stopAudioButton.style.display = 'block';
            const message = storedName
                ? `Your name is ${storedName}.`
                : "I don't know your name yet. You can tell me by saying 'My name is [your name]'.";
            addMessageToChat('assistant', message);
            await queueAudioChunk(message);
            state.isAISpeaking = false;
            elements.stopAudioButton.style.display = 'none';
            return true;
        }
    }

    // ... rest of the patterns ...

    // In handleCommand function, add proper state handling for jokes listing
    for (const pattern of patterns.listJokes) {
        const match = text.match(pattern);
        if (match) {
            state.isAISpeaking = true;
            elements.stopAudioButton.style.display = 'block';

            try {
                // First check if the server is available
                const serverCheck = await fetch(`${SERVER_URL}/api/health`).catch(() => null);

                if (!serverCheck?.ok) {
                    throw new Error('Server unavailable');
                }

                // Build URL with query parameters properly
                const url = new URL(`${SERVER_URL}/api/jokes/list-jokes`);
                url.searchParams.append('sessionId', window.sessionId);
                url.searchParams.append('type', 'my_jokes');  // Changed from 'my jokes' to 'my_jokes'

                // Make the jokes request
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.error('Jokes API Error:', {
                        status: response.status,
                        statusText: response.statusText,
                        url: url.toString()
                    });

                    const errorText = await response.text();
                    console.error('Error response:', errorText);

                    throw new Error(`Server error: ${response.status}`);
                }

                const data = await response.json();

                if (data.success && data.jokes?.length > 0) {
                    const jokeList = data.jokes
                        .map((joke, index) => `${index + 1}. ${joke.content}`)
                        .join('\n\n');

                    const message = `Here are your saved jokes:\n\n${jokeList}`;
                    addMessageToChat('assistant', message);
                    await queueAudioChunk(message);
                } else {
                    const message = "You haven't saved any jokes yet. Would you like me to tell you a joke that you can save?";
                    addMessageToChat('assistant', message);
                    await queueAudioChunk(message);
                }
            } catch (error) {
                console.error('Error listing jokes:', error);
                const errorMessage = error.message === 'Server unavailable'
                    ? "Sorry, the jokes service is currently unavailable. Please try again later."
                    : "Sorry, there was an error retrieving your jokes. Would you like me to tell you a new joke instead?";

                addMessageToChat('assistant', errorMessage);
                await queueAudioChunk(errorMessage);
            } finally {
                state.isAISpeaking = false;
                elements.stopAudioButton.style.display = 'none';
            }
            return true;
        }
    }

    // Check for Bing search requests
    if (text.toLowerCase().includes('search for') ||
        text.toLowerCase().includes('look up')) {
        return await handleBingSearch.handleSearchRequest(text);
    }
}

// Generate Greeting
async function generateGreeting() {
    const hour = new Date().getHours();
    const timeOfDay = getTimeOfDay();
    const today = new Date();
    const holiday = getHoliday(today);

    // Get user's name from localStorage with correct key
    let userName = localStorage.getItem('stored_name');

    // If not in localStorage, try MongoDB
    if (!userName) {
        try {
            const response = await fetch(`/api/personal-info/name?sessionId=${window.sessionId}`);
            const data = await response.json();
            if (data && data.value) {
                userName = data.value;
                localStorage.setItem('stored_name', userName);
            }
        } catch (error) {
            console.error('Error getting user name:', error);
        }
    }

    // Add comma only if we have a name
    userName = userName ? `, ${userName}` : '';

    if (holiday) {
        return `${holiday.greeting}${userName}`;
    }

    const greetings = {
        morning: [
            `Good morning${userName}! How can I help you today?`,
            `Rise and shine${userName}! How may I assist you?`,
            `Good morning${userName}! What can I do for you?`,
            `Morning${userName}! Hope you slept well!`
        ],
        afternoon: [
            `Good afternoon${userName}! How can I help you today?`,
            `Having a good day${userName}?`,
            `Hope your day is going well${userName}!`,
            `Afternoon${userName}! How may I assist you?`
        ],
        evening: [
            `Good evening${userName}! How can I help you today?`,
            `Evening${userName}! How was your day?`,
            `Hope you had a great day${userName}!`,
            `Evening${userName}! What can I do for you?`
        ]
    };

    const options = greetings[timeOfDay];
    return options[Math.floor(Math.random() * options.length)];
}


// =====================================================
// ---> PATTERNS AND REGEX
// =====================================================

function getPatterns() {
    return {
        greetings: [
            /^hi$/i,
            /^hi\s+there$/i,
            /^hello$/i,
            /^hey$/i
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
        rememberInfo: [
            /^remember that (.+?) is (.+)$/i,
            /^remember (.+?) is (.+)$/i,
            /^please remember that (.+?) is (.+)$/i,
            /^please remember (.+?) is (.+)$/i
        ],
        getPersonalInfo: [
            /^what(?:'s| is) my (.+)\??$/i,
            /^tell me (?:about )?my (.+)\??$/i,
            /^do you remember my (.+)\??$/i,
            /^what do you remember about my (.+)\??$/i,
            /^show me my personal info(?:rmation)?\??$/i,
            /^what do you know about me\??$/i
        ],
        exit: [
            /^(exit|quit|bye|goodbye)$/i
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
            getMyJoke: /(?:tell|show|get|read)(?:\s+me)?\s+my\s+joke\s+(?:about|with|containing)\s+"?([^"]+)"?/i,
            deleteJoke: /^delete joke id (\w+)$/i
        },
        listJokes: [
            /^(show|list|tell me|get|read)?\s*(my jokes|all jokes)\s*$/i,
            /^what(?:.*?)(my jokes|all jokes)(?:.*?)$/i
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
            // Match any play request that includes youtube
            playVideo: /(^play|youtube play|play.*youtube|youtube.*play)/i  // Updated pattern
        },
        location: /(?:at|in|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
        event: /(?:tomorrow|next|on|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
        storeName: [
            /^remember (?:that )?my name is (.+)$/i,
            /^my name is (.+)$/i
        ],
        confirmChange: [
            /^(yes|no)$/i
        ],
        getName: [
            /^what(?:'s| is) my name\??$/i,
            /^tell me my name\??$/i,
            /^do you remember my name\??$/i
        ],
    };
}

// Add these helper functions near getGreeting
function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
}

function getHoliday(date) {
    const month = date.getMonth() + 1; // JavaScript months are 0-based
    const day = date.getDate();
    const year = date.getFullYear();

    // Calculate Thanksgiving (4th Thursday of November)
    if (month === 11) {  // November
        const thanksgiving = new Date(year, 10, 1);  // Start with November 1
        while (thanksgiving.getDay() !== 4) {  // Find first Thursday
            thanksgiving.setDate(thanksgiving.getDate() + 1);
        }
        thanksgiving.setDate(thanksgiving.getDate() + 21);  // Add 3 weeks

        if (day === thanksgiving.getDate()) {
            return {
                name: "Thanksgiving Day",
                greeting: "Happy Thanksgiving!"
            };
        }
    }

    // Fixed date holidays
    const holidays = {
        "1/1": { name: "New Year's Day", greeting: "Happy New Year!" },
        "7/4": { name: "Independence Day", greeting: "Happy Independence Day!" },
        "12/24": { name: "Christmas Eve", greeting: "Merry Christmas Eve!" },
        "12/25": { name: "Christmas Day", greeting: "Merry Christmas!" },
        "12/31": { name: "New Year's Eve", greeting: "Happy New Year's Eve!" }
    };

    const dateKey = `${month}/${day}`;
    return holidays[dateKey] || null;
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
        updateStatus(MESSAGES.STATUS.LISTENING);

        // Update conversation status with the enable message
        if (elements.conversationStatus) {
            elements.conversationStatus.innerHTML = `<span class="conversation-enable-message">${MESSAGES.CONVERSATION.ENABLE}</span>`;
        }

        startListening();
    } else {
        clearInactivityTimer();
        console.log('Inactivity timer cleared');
        updateStatus(MESSAGES.STATUS.DEFAULT);
        stopListening();
        // Clear the conversation status
        if (elements.conversationStatus) {
            elements.conversationStatus.innerHTML = '';
        }
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
async function sendMessage(message, isGreeting = false) {
    try {
        if (isGreeting) {
            const greeting = await generateGreeting();
            // Add user's greeting to chat first
            addMessageToChat('user', 'hello');
            // Add AI's greeting with greeting-bubble class
            addMessageToChat('assistant', greeting, {
                type: 'greeting',
                messageType: 'greeting-bubble'
            });
            await queueAudioChunk(greeting);
            return;
        }

        const messageText = message;  // Initialize properly
        const patterns = getPatterns();

        // Check for exit command first
        if (messageText.toLowerCase() === 'exit') {
            await exitConversation();
            return;
        }

        // Check for save joke command
        if (patterns.saveJoke.some(pattern => pattern.test(messageText.toLowerCase()))) {
            addMessageToChat('user', messageText);
            await handleMyJokes.startSaving();
            return;
        }

        // Check for pending joke save
        if (state.savingJoke) {
            addMessageToChat('user', messageText);
            await handleMyJokes.saveJoke(messageText);
            return;
        }

        // Check for list jokes commands
        const listJokeMatch = patterns.jokes.listAll.test(messageText.toLowerCase()) ||
                            patterns.jokes.listMine.test(messageText.toLowerCase());
        if (listJokeMatch) {
            addMessageToChat('user', messageText);
            const showAll = messageText.toLowerCase().includes('all jokes');
            await handleMyJokes.listJokes(showAll);
            return;
        }

        // Check for "tell me my joke about X" pattern
        const jokeMatch = patterns.jokes.getMyJoke.exec(messageText.toLowerCase());
        if (jokeMatch) {
            addMessageToChat('user', messageText);
            await handleMyJokes.retrieveJoke(jokeMatch[1]);
            return;
        }

        // Check for YES/NO responses to pending joke actions
        const pendingJoke = sessionStorage.getItem('pendingJoke');
        if (pendingJoke && /^yes$/i.test(messageText)) {
            addMessageToChat('user', messageText);
            const joke = JSON.parse(pendingJoke);
            addMessageToChat('assistant', joke.content);
            await queueAudioChunk(joke.content);
            sessionStorage.removeItem('pendingJoke');
            return;
        } else if (pendingJoke && /^no$/i.test(messageText)) {
            addMessageToChat('user', messageText);
            addMessageToChat('assistant', "Okay, maybe next time!");
            await queueAudioChunk("Okay, maybe next time!");
            sessionStorage.removeItem('pendingJoke');
            return;
        }

        // Check for YouTube request
        if (patterns.youtube.searchVideos.test(messageText) || patterns.youtube.playVideo.test(messageText)) {
            await handleYoutube.handleYoutubeRequest(messageText);
            return;
        }

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
    } catch (error) {
        console.error('Error in greeting:', error);
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
function addMessageToChat(role, content, options = {}) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    // Initialize dataset if needed
    if (!messageDiv.dataset) {
        messageDiv.dataset = {};
    }

    // Add special classes for greeting and exit messages
    if (options.type === 'greeting') {
        messageDiv.classList.add('greeting-bubble');
    } else if (options.type === 'exit') {
        messageDiv.classList.add('exit-bubble');
    }

    // Set model info FIRST for all assistant messages
    if (role === 'assistant') {
        try {
            if (options.type === 'image-analysis') {
                messageDiv.dataset.model = 'gpt-4o';
            } else {
                const modelSelect = document.getElementById('model-select');
                messageDiv.dataset.model = modelSelect?.value || 'gpt-4o-mini';
            }
        } catch (e) {
            console.warn('Error setting model info:', e);
            messageDiv.dataset.model = 'gpt-4o-mini';
        }
    }

    // Determine if this is a system-type message
    const isSystemType = options.type === 'greeting' ||
        options.type === 'system' ||
        options.type === 'time' ||
        options.type === 'date' ||
        options.type === 'dateTime' ||
        options.type === 'exit';

    // Add metadata first for all assistant messages except system types and greetings
    if (role === 'assistant' && !isSystemType && options.type !== 'greeting') {
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'metadata';
        messageDiv.appendChild(metadataDiv);

        // Add separator after metadata
        const separator = document.createElement('hr');
        messageDiv.appendChild(separator);
    }

    // Create content container and add content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Handle different content types
    switch(options.type) {
        case 'bing-search':
        case 'youtube-list':
            contentDiv.innerHTML = content;
            break;
        case 'image-analysis':
            contentDiv.innerHTML = `<div class="image-analysis">${content}</div>`;
            break;
        case 'code':
            contentDiv.innerHTML = `<pre><code>${content}</code></pre>`;
            break;
        case 'joke':
            contentDiv.innerHTML = `<div class="joke-content">${content}</div>`;
            break;
        default:
            if (content.includes('# Web Results') ||
                content.includes('# News Results') ||
                content.includes('<div class="youtube-results">')) {
                contentDiv.innerHTML = content;
            } else {
                contentDiv.textContent = content;
            }
    }

    messageDiv.appendChild(contentDiv);
    elements.chatMessages.appendChild(messageDiv);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

    // Update metadata for assistant messages
    if (role === 'assistant' && !isSystemType) {
        updateMetadata(messageDiv);
    }

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
        const modelName = document.getElementById('model-select').value;
        const duration = ((Date.now() - state.lastRequestTime) / 1000).toFixed(2);

        metadataElement.innerHTML = `
            <span class="model-info">${modelName}</span>&nbsp;|&nbsp;
            <span class="response-time">${duration}s</span>&nbsp;|&nbsp;
            <span class="token-count">${tokenCount} tokens</span>
        `;
    }
}

// Update metadata function
function updateMetadata(messageElement, metadata) {
    const metadataElement = messageElement.querySelector('.metadata');
    if (!metadataElement) return;

    // Get model name with proper fallbacks
    let modelName = 'gpt-4o-mini';  // Set default first

    try {
        if (messageElement.classList.contains('image-analysis')) {
            modelName = 'gpt-4o';
        } else {
            modelName = messageElement.dataset.model || document.getElementById('model-select')?.value || 'gpt-4o-mini';
        }
    } catch (e) {
        console.warn('Error getting model name:', e);
        // Keep default model name
    }

    // Get timing information
    const startTime = parseInt(messageElement.dataset.startTime) || Date.now();
    const endTime = metadata?.endTime || metadata?.metrics?.endTime || Date.now();
    const durationInSeconds = metadata?.metrics?.durationInSeconds ||
        metadata?.duration ||
        ((endTime - startTime) / 1000).toFixed(2);

    // Get token count from metrics or use placeholder
    const tokenCount = metadata?.metrics?.totalTokens ||
        metadata?.tokenCount ||
        Math.floor(Math.random() * 50) + 20;

    metadataElement.innerHTML = `
        <span class="model-info">${modelName}</span>&nbsp;|&nbsp;
        <span class="response-time">${durationInSeconds}s</span>&nbsp;|&nbsp;
        <span class="token-count">${tokenCount} tokens</span>
    `;

    // Check for recipe content and handle recipe buttons
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
    try {
        // Stop listening first
            stopListening();

        // Add user's exit message
        addMessageToChat('user', 'exit');

        // Create exit message with special styling
        const exitMessage = MESSAGES.CLOSINGS.EXIT;
        addMessageToChat('assistant', exitMessage, {
            type: 'exit',
            messageType: 'exit'
        });

        // Queue the exit message audio
        await queueAudioChunk(exitMessage);

        // Reset conversation mode and update UI
        state.isConversationMode = false;
        elements.conversationModeToggle.checked = false;
        elements.conversationStatus.innerHTML = '';
        updateStatus(MESSAGES.STATUS.DEFAULT);

        // Clear any pending timers
        if (state.inactivityTimer) {
            clearTimeout(state.inactivityTimer);
            state.inactivityTimer = null;
        }

    } catch (error) {
        console.error('Error in exitConversation:', error);
        addMessageToChat('system', MESSAGES.ERRORS.EXIT);
    } finally {
        state.isAISpeaking = false;
        elements.stopAudioButton.style.display = 'none';
    }
}

// Update status function
function updateStatus(message) {
    if (elements.status) {
        // Remove all status classes
        elements.status.classList.remove(
            'status-default',
            'status-listening',
            'status-video-playing',
            'status-processing',
            'status-error',
            'status-initializing'
        );

        // Add appropriate class based on message
        if (message === MESSAGES.STATUS.DEFAULT) {
            elements.status.classList.add('status-default');
        } else if (message === MESSAGES.STATUS.LISTENING) {
            elements.status.classList.add('status-listening');
        } else if (message === MESSAGES.STATUS.VIDEO_PLAYING) {
            elements.status.classList.add('status-video-playing');
        } else if (message === MESSAGES.STATUS.PROCESSING) {
            elements.status.classList.add('status-processing');
        } else if (message === MESSAGES.STATUS.ERROR) {
            elements.status.classList.add('status-error');
        } else if (message === MESSAGES.STATUS.INITIALIZING) {
            elements.status.classList.add('status-initializing');
        }

        elements.status.textContent = message;
    }
}

// Retrieve personal info function
async function getPersonalInfo(key = null) {
    try {
        state.isAISpeaking = true;
        elements.stopAudioButton.style.display = 'block';

        const response = await fetch(`/api/personal-info?userId=${window.sessionId}${key ? `&key=${key}` : ''}`);
        const data = await response.json();

        if (data.success && data.info) {
            // If asking about hobbies specifically
            if (key && key.toLowerCase().includes('hobb')) {
                const hobbies = data.info.content.split(',').map(h => h.trim());
                const message = `Your hobbies are: ${hobbies.join(', ')}`;
                addMessageToChat('assistant', message);
                await queueAudioChunk(message);
            } else {
                const message = data.info.content;
                addMessageToChat('assistant', message);
                await queueAudioChunk(message);
            }
        } else {
            const message = "I don't have any information about that yet.";
            addMessageToChat('assistant', message);
            await queueAudioChunk(message);
        }
    } catch (error) {
        console.error('Error getting personal info:', error);
        const errorMessage = "Sorry, there was an error retrieving your information.";
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
    console.log('Starting inactivity timer for', INTERVAL, 'minute(s)');

    // Clear any existing timer
    if (state.inactivityTimer) {
        clearTimeout(state.inactivityTimer);
    }

    // Set new timer
    state.inactivityTimer = setTimeout(async () => {
        console.log('Inactivity timeout reached');

        // Stop listening
        stopListening();

        // Create timeout message
        const timeoutMessage = MESSAGES.CLOSINGS.TIMEOUT(INTERVAL);
        addMessageToChat('assistant', timeoutMessage, {
            type: 'exit',
            messageType: 'exit'
        });

        // Queue the timeout message audio
        await queueAudioChunk(timeoutMessage);

        // Reset conversation mode
        state.isConversationMode = false;
        elements.conversationModeToggle.checked = false;
        elements.conversationStatus.innerHTML = '';
        updateStatus(MESSAGES.STATUS.DEFAULT);

        // Clear the timer reference
        state.inactivityTimer = null;

        }, CONVERSATION_INACTIVITY_TIMEOUT);

    // Log timer details
        console.log('Timer set:', {
            interval: INTERVAL,
            timeout: CONVERSATION_INACTIVITY_TIMEOUT,
            currentTime: new Date().toISOString(),
            willTriggerAt: new Date(Date.now() + CONVERSATION_INACTIVITY_TIMEOUT).toISOString()
        });
}

// Clear inactivity timer function
function clearInactivityTimer() {
        console.log('Clearing inactivity timer');
    if (state.inactivityTimer) {
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
    if (!event.results || !event.results.length) return;

    const result = event.results[event.results.length - 1];
    if (!result.isFinal) return;

    const transcript = result[0].transcript.trim();
    const confidence = result[0].confidence;
    console.log('Speech recognition result:', {
        transcript,
        confidence,
        timestamp: new Date().toISOString()
    });

    // Check for exit command first
    if (transcript.toLowerCase() === 'exit') {
        exitConversation();
        return;
    }

    // Check if it's a greeting
    const isGreeting = getPatterns().greetings.some(pattern =>
        pattern.test(transcript.toLowerCase())
    );

    sendMessage(transcript, isGreeting);
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

window.printRecipe = async function(recipeText, messageElement) {
    try {
        console.log('Recipe text sent to server:', recipeText.substring(0, 200)); // Log what we're sending

        const response = await fetch('/api/recipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: recipeText })
        });

        const data = await response.json();
        console.log('Server response:', data); // Log what we get back

        if (!data.success) throw new Error(data.error);

        const recipeName = data.recipe.name;
        console.log('Recipe name from server:', recipeName); // Log the name we'll use

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

// Add validation before storing personal info
async function storePersonalInfo(info) {
    try {
        state.isAISpeaking = true;
        elements.stopAudioButton.style.display = 'block';

        // Clean up the info text by removing "remember that" or "remember"
        let cleanInfo = info
            .replace(/^remember that /i, '')
            .replace(/^remember /i, '')
            .replace(/^my /i, 'your ');  // Replace "my" with "your"

        const response = await fetch('/api/personal-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: window.sessionId,
                content: cleanInfo
            })
        });

        const data = await response.json();
        if (data.success) {
            const message = `I'll remember that ${cleanInfo}`;
            addMessageToChat('assistant', message);
            await queueAudioChunk(message);
        }
    } catch (error) {
        console.error('Error storing personal info:', error);
        const errorMessage = "Sorry, there was an error storing your information.";
        addMessageToChat('assistant', errorMessage);
        await queueAudioChunk(errorMessage);
    } finally {
        state.isAISpeaking = false;
        elements.stopAudioButton.style.display = 'none';
    }
}

// Add validation when retrieving personal info
function getPersonalInfo(type) {
    return localStorage.getItem(type);
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
        currentTitle: null,
        currentContent: null,
        savingJoke: false
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

        return false; // Message wasn't joke-related
    },

    // Save joke to database
    async saveJoke() {
        try {
            const response = await fetch('/api/jokes/save-joke', {
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
            state.isAISpeaking = true;
            elements.stopAudioButton.style.display = 'block';
            // Normalize the title to match how it's stored
            const normalizedTitle = title.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
            const response = await fetch(`/api/jokes/get-joke/${encodeURIComponent(normalizedTitle)}?sessionId=${window.sessionId}`);
            const data = await response.json();

            if (data.success && data.joke) {
                const message = "I found your joke. Would you like to hear it?";
                addMessageToChat('assistant', message);
                await queueAudioChunk(message);
                // Store the joke content for when user says yes
                sessionStorage.setItem('pendingJoke', JSON.stringify(data.joke));
            } else {
                const message = `Sorry, I couldn't find a joke about "${title}".`;
                addMessageToChat('assistant', message);
                await queueAudioChunk(message);
            }
        } catch (error) {
            console.error('Error retrieving joke:', error);
            const errorMessage = "Sorry, there was an error retrieving your joke.";
            addMessageToChat('assistant', errorMessage);
            await queueAudioChunk(errorMessage);
        } finally {
            state.isAISpeaking = false;
            elements.stopAudioButton.style.display = 'none';
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

            console.log('List jokes request:', {
                showAll,
                userId: window.sessionId
            });

            // Use the v19.4.1 endpoint
            const response = await fetch(`/api/jokes/list-jokes?type=my jokes&sessionId=${window.sessionId}`);
            const data = await response.json();

            if (data.success && data.jokes && data.jokes.length > 0) {
                const messageText = "Here is a listing of your jokes:";
                addMessageToChat('assistant', messageText);

                // Create message element with joke list
                const messageElement = document.createElement('div');
                messageElement.className = 'message assistant';

                // Create numbered list
                const list = document.createElement('ol');
                data.jokes.forEach(joke => {
                    const item = document.createElement('li');
                    item.textContent = joke.title;
                    list.appendChild(item);
                });

                messageElement.appendChild(list);

                // Add help text after the list
                const helpText = document.createElement('p');
                helpText.style.marginTop = '10px';
                helpText.style.fontStyle = 'italic';
                helpText.textContent = 'To hear your joke, ask... "Tell me my joke about [joke name]"';
                messageElement.appendChild(helpText);

                elements.chatMessages.appendChild(messageElement);

                // Read out the list of jokes
                await queueAudioChunk(messageText);
                for (let i = 0; i < data.jokes.length; i++) {
                    await queueAudioChunk(`Number ${i + 1}: ${data.jokes[i].title}`);
                }
                await queueAudioChunk("To hear your joke, ask Tell me my joke about, followed by the joke name");
            } else {
                const message = "You haven't saved any jokes yet.";
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
                startListening();
            }
        }
    },

    // Add this new method to handleMyJokes
    async deleteJoke(title) {
        try {
            state.isAISpeaking = true;
            elements.stopAudioButton.style.display = 'block';
            // First get the joke to get its ID
            const getResponse = await fetch(`/api/jokes/delete-joke/${encodeURIComponent(title)}`);
            const getData = await getResponse.json();

            if (!getData.success) {
                throw new Error('Joke not found');
            }

            // Then delete using the ID
            const response = await fetch(
                `/api/jokes/delete-joke/${getData.joke.id}`,
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
            const response = await fetch(`/api/jokes/update-joke/${encodeURIComponent(title)}`, {
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
            const response = await fetch(`/api/jokes/search-jokes?term=${encodeURIComponent(searchTerm)}`);
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
    },

    // Migrate jokes between users
    async migrateJokes(fromUserId, toUserId) {
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
            return data;
        } catch (error) {
            console.error('Error migrating jokes:', error);
            throw error;
        }
    },

    // Display jokes in a formatted list
    displayJokes(jokes) {
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
    },
};


// =====================================================
// YOUTUBE MODULE
// =====================================================

const handleYoutube = {
    isPlaying: false,

    async handleYoutubeRequest(messageText) {
        console.log('handleYoutubeRequest received:', messageText);
        const patterns = getPatterns();

        // Add user's message first
        addMessageToChat('user', messageText);  // Add this line

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
                const videoList = document.createElement('div');
                videoList.className = 'youtube-results';
                videoList.innerHTML = `
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
                    </ol>`;

                // Add message with both text and video list
                const messageElement = document.createElement('div');
                messageElement.textContent = message;
                addMessageToChat('assistant', messageElement.outerHTML + videoList.outerHTML, {
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

        // Create iframe with event listener
        const iframe = document.createElement('iframe');
        iframe.width = "100%";
        iframe.height = "100%";
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        iframe.frameBorder = "0";
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;

        // When iframe loads, update status and mic state
        iframe.onload = () => {
            // Force stop listening and update states
            stopListening();
            state.isListening = false;
            // Store previous conversation mode state
            this.previousConversationMode = state.isConversationMode;
            state.isConversationMode = false;  // Temporarily disable conversation mode

            // Update status and mic visual state
            updateStatus(MESSAGES.STATUS.VIDEO_PLAYING);
            if (elements.microphoneButton) {
                elements.microphoneButton.classList.remove('active');
            }
        };

        videoWrapper.innerHTML = '';
        videoWrapper.appendChild(iframe);
        elements.videoContainer.classList.remove('hidden');
        this.isPlaying = true;
    },

    hideVideo() {
        if (elements.videoContainer) {
            const videoWrapper = document.getElementById('youtube-video');
            videoWrapper.innerHTML = '';
            elements.videoContainer.classList.add('hidden');
            this.isPlaying = false;

            // Restore previous conversation mode state
            if (this.previousConversationMode) {
                state.isConversationMode = true;
                state.isListening = true;
                // Ensure recognition is restarted
                if (state.recognition) {
                    state.recognition.start();
                } else {
                    initializeSpeechRecognition();
                    state.recognition.start();
                }
                updateStatus(MESSAGES.STATUS.LISTENING);
                // Update mic visual state
                if (elements.microphoneButton) {
                    elements.microphoneButton.classList.add('active');
                    elements.microphoneButton.textContent = '🔴';  // Active mic indicator
                }
            } else {
                updateStatus(MESSAGES.STATUS.DEFAULT);
            }
            // Clear stored state
            this.previousConversationMode = null;
        }
    }
};


// =====================================================
// BING SEARCH MODULE
// =====================================================

const handleBingSearch = {
    async handleSearchRequest(messageText) {
        console.log('Bing search request:', messageText);

        // Stop listening during search playback
        if (state.isListening) {
            stopListening();
            state.isListening = false;
            updateStatus('Microphone disabled during search playback');
        }

        try {
            const query = messageText
                .replace(/search for|look up/i, '')
                .trim();

            const response = await fetch('/api/bing-search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });

            const data = await response.json();
            addMessageToChat('assistant', data.response);
            return true;
        } catch (error) {
            console.error('Bing search error:', error);
            addMessageToChat('assistant', 'Sorry, there was an error processing your search request.');
            return true;
        }
    }
};



// =====================================================
// END OF app.js FILE v20.0.0
// =====================================================