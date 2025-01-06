/*
  SERVER.js
  Version: 20.0.0
  AppName: Multi-Chat [v20.0.0]
  Created by Paul Welby
  updated: January 5, 2025 @7:30PM
*/

// Required dependencies
const express          = require('express');
const cors             = require('cors');
const dotenv           = require('dotenv');
const { MongoClient }  = require('mongodb');
const path             = require('path');
const sdk              = require('microsoft-cognitiveservices-speech-sdk');
const OpenAI           = require('openai');
const axios            = require('axios');
const mongoose         = require('mongoose');
const { google }       = require('googleapis');

// Load environment variables FIRST
dotenv.config();

// Initialize YouTube API AFTER loading env vars
const youtube = google.youtube({
    version: 'v3',
    auth: process.env.GOOGLE_API_KEY
});

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Express
const app = express();

// Set the port
const port = process.env.PORT || 32000;

// Configure middleware with increased limits
app.use(cors());
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));

// Set up the calls to open INDEX.HTML
app.use(express.static(path.join(__dirname, 'public')));

console.log('Starting server initialization...');


// =====================================================
// UTILITY/HELPER FUNCTIONS
// =====================================================

// TIME RELATED FUNCTIONS

// Format the timestamp
function formatTimestamp(date) {
    return new Intl.DateTimeFormat('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Los_Angeles',
        hour12: true
    }).format(date);
}

// PATTERNS for time, date, greetings, and bing search
const chatPatterns = {
    greetings: [
        /^hi$/i,
        /^hello$/i,
        /^hey$/i
    ],
    time: [
        /what(?:'s| is)(?: the)?(?: local)? time/i,
        /tell me(?: the)?(?: local)? time/i
    ],
    date: [
        /what(?:'s| is)(?: the)?(?: current)? date/i,
        /tell me(?: the)? date/i
    ],
    dateTime: [
        /date and time/i,
        /time and date/i
    ]
};

// Holiday helper function
function getHoliday(date) {
    const month = date.getMonth() + 1; // JavaScript months are 0-based
    const day = date.getDate();
    const year = date.getFullYear();

    console.log('Checking holiday for:', { month, day, year });

    // Calculate Thanksgiving (4th Thursday of November)
    if (month === 11) {  // November
        console.log('November detected, calculating Thanksgiving...');

        const thanksgiving = new Date(year, 10, 1);  // Start with November 1
        console.log('Starting with:', thanksgiving.toDateString());

        // Find first Thursday
        while (thanksgiving.getDay() !== 4) {
            thanksgiving.setDate(thanksgiving.getDate() + 1);
        }
        console.log('First Thursday:', thanksgiving.toDateString());

        // Add 3 weeks to get to 4th Thursday
        thanksgiving.setDate(thanksgiving.getDate() + 21);
        console.log('Fourth Thursday:', thanksgiving.toDateString());

        console.log('Detailed comparison:', {
            thanksgivingDate: thanksgiving.getDate(),
            currentDay: day,
            thanksgivingMonth: thanksgiving.getMonth() + 1,
            currentMonth: month,
            thanksgivingYear: thanksgiving.getFullYear(),
            currentYear: year,
            isExactMatch: day === thanksgiving.getDate() && month === (thanksgiving.getMonth() + 1)
        });

        if (day === thanksgiving.getDate()) {
            console.log('MATCH FOUND - Returning Thanksgiving greeting');
            return {
                name: "Thanksgiving Day",
                greeting: "Happy Thanksgiving!"
            };
        } else {
            console.log('No match - Thanksgiving date differs');
        }
    }

    // Rest of the holiday checks...
    const holidays = {
        "1/1": "New Year's Day",
        "7/4": "Independence Day",
        "12/24": "Christmas Eve",
        "12/25": "Christmas Day",
        "12/31": "New Year's Eve"
    };

    const dateKey = `${month}/${day}`;
    console.log('Checking fixed holiday dateKey:', dateKey);

    if (holidays[dateKey]) {
        console.log('Found fixed holiday:', holidays[dateKey]);
        return {
            name: holidays[dateKey],
            greeting: `Happy ${holidays[dateKey]}!`
        };
    }

    console.log('No holiday found for this date');
    return null;
}

// Format the time and date strings
function formatTimeDateStr(date, timezone = 'America/Los_Angeles') {
    return {
        timeStr: date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
        }),

        dateStr: date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: timezone
        })
    };
}

// Get the time of day
function getTimeOfDay(timezone = 'America/Los_Angeles') {
    const hour = new Date().toLocaleString('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: timezone
    });

    const hourNum = parseInt(hour);

    if (hourNum >= 5 && hourNum < 12) {
        return 'morning';
    } else if (hourNum >= 12 && hourNum < 17) {
        return 'afternoon';
    } else {
        return 'evening';
    }
}

// Format the minutes plural
function formatMinutesPlural(minutes) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}
// =====================================================
// LOGGING FUNCTIONS
// =====================================================

// Update the logging middleware
app.use((req, res, next) => {
    const timestamp = formatTimestamp(new Date());
    console.log('\n━━━━━━ New Request ━━━━━━━━━━━');
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Endpoint: ${req.path}`);
    console.log(`Method: ${req.method}`);
    if (req.method === 'POST' && Object.keys(req.body).length > 0) {
        console.log('Request Body:', req.body);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Capture response metadata
    const oldWrite = res.write;
    const oldEnd = res.end;

    res.write = function(chunk, ...args) {
        if (chunk && !res.writableEnded) {
            try {
                const data = JSON.parse(chunk.toString().replace('data: ', ''));
                if (data.metrics) {
                    console.log('\n━━━━━━━━━━━ Response Metrics ━━━━━━━━━━━');
                    console.log(`Time: ${formatTimestamp(new Date())}`);
                    console.log('Duration:', data.metrics.duration || 'In progress');
                    console.log('Prompt Tokens:', data.metrics.promptTokens || 0);
                    console.log('Completion Tokens:', data.metrics.completionTokens || 0);
                    console.log('Total Tokens:', data.metrics.totalTokens || 0);
                    console.log('Model:', data.metrics.model || 'Unknown');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                }
            } catch (e) {
                // Not JSON or not metrics data
            }
            return oldWrite.apply(res, [chunk, ...args]);
        }

    };

    res.end = function(...args) {
        if (!res.writableEnded) {
            const timestamp = formatTimestamp(new Date());
            console.log('\n━━━━━━━━━━━ Response ━━━━━━━━━━━');
            console.log(`Status: ${res.statusCode}`);
            console.log(`Time: ${timestamp}`);
            if (res.get('Content-Type')?.includes('text/event-stream')) {
                console.log('Response: [SSE Stream]');
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            return oldEnd.apply(res, args);
        }
    };

    next();
});


// =====================================================
// ROUTES
// =====================================================

// Add new route to get all personal info FIRST
app.get('/api/personal-info/all', async (req, res) => {
    try {
        const { sessionId } = req.query;
        console.log('Received request for all personal info:', { sessionId });
        const userId = sessionId.split('-')[0];

        console.log('Looking up user:', { userId });
        const info = await PersonalInfo.findOne(
            { userId },
            { personalInfo: 1, _id: 0 }
        ).sort({ lastUpdated: -1 });

        console.log('Found info:', info);
        res.json(info || { personalInfo: {} });
    } catch (error) {
        console.error('Error retrieving personal info:', {
            error: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ error: error.message });
    }
});

// THEN the type-specific route
app.get('/api/personal-info/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const sessionId = `${PERSISTENT_SESSION.type}-${PERSISTENT_SESSION.id}-${PERSISTENT_SESSION.version}`;

        console.log('DEBUG - Retrieving personal info:', {
            type,
            sessionId,
            collection: 'conversation_history',
            database: mongoose.connection.name
        });

        const info = await PersonalInfo.findOne(
            {
                sessionId: sessionId,  // Use the correct sessionId
                type: type            // And the type we're looking for
            },
            { value: 1, _id: 0 }
        ).sort({ timestamp: -1 });

        console.log('MongoDB query result:', {
            found: !!info,
            value: info?.value,
            collection: info?.collection?.name
        });

        res.json({ value: info?.value || null });
    } catch (error) {
        console.error('Error retrieving personal info:', error);
        res.status(500).json({ error: error.message });
    }
});

// THEN the post route
app.post('/api/personal-info', async (req, res) => {
    try {
        const { type, value } = req.body;

        // Log the request details to help track unwanted updates
        console.log('Personal info storage request:', {
            type,
            value,
            headers: req.headers,
            timestamp: new Date().toISOString(),
            referrer: req.headers.referer,
            source: req.headers['x-request-source'] || 'unknown'
        });

        // For name updates, check if it's an unwanted overwrite
        if (type === 'name') {
            // Get the current stored name
            const currentInfo = await PersonalInfo.findOne(
                { userId: PERSISTENT_SESSION.id, type: 'name' }
            ).sort({ timestamp: -1 });

            // If there's an existing name and this is an unwanted overwrite
            if (currentInfo?.value &&
                value.toLowerCase().includes('relieved') &&
                req.headers['x-request-source'] === 'ai-response') {
                console.warn('Prevented unwanted name overwrite:', {
                    current: currentInfo.value,
                    attempted: value
                });
                return res.status(400).json({
                    error: 'Invalid update attempt',
                    details: 'Prevented unwanted name overwrite from AI response'
                });
            }
        }

        const sessionId = `${PERSISTENT_SESSION.type}-${PERSISTENT_SESSION.id}-${PERSISTENT_SESSION.version}`;

        // Store the info
        const info = new PersonalInfo({
            userId: PERSISTENT_SESSION.id,
            sessionId,
            sessionType: PERSISTENT_SESSION.type,
            sessionVersion: PERSISTENT_SESSION.version,
            type,
            value,
            timestamp: new Date(),
            created: new Date(),
            updated: new Date()
        });

        await info.save();
        console.log('Successfully stored in MongoDB:', {
            id: info._id,
            type,
            value,
            collection: info.collection.name
        });
        res.json({ success: true, value });
    } catch (error) {
        console.error('Error storing personal info:', error);
        res.status(500).json({ error: error.message });
    }
});


// basic route for index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Azure TTS voices endpoint
app.get('/api/voices', async (req, res) => {
    console.log('Fetching voices from Azure...');
    try {
        if (!process.env.SPEECH_API_KEY) {
            throw new Error('SPEECH_API_KEY is not set in the environment variables');
        }

        const response = await axios.get(
            'https://eastus.tts.speech.microsoft.com/cognitiveservices/voices/list',
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': process.env.SPEECH_API_KEY
                },
                timeout: 10000 // 10 seconds timeout
            }
        );
        console.log('Voices fetched successfully. Count:', response.data.length);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching voices:', error);
        res.status(500).json({
            error: 'Failed to fetch voices',
            details: error.message
        });
    }
});

// TTS endpoint with correct environment variable name
app.post('/api/tts', async (req, res) => {
    console.log('\n=== TTS Request Started ===');
    try {
        const { text, voice } = req.body;
        console.log('Request body:', { text, voice });

        if (!text || !voice) {
            throw new Error('Missing text or voice parameter');
        }

        // Prepare SSML
        const ssml = `
            <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
                <voice name="${voice}">
                    ${text}
                </voice>
            </speak>`;

        const endpoint = `https://${process.env.SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
        console.log('Sending request to Azure...');

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': process.env.SPEECH_API_KEY,
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
                'User-Agent': 'ChatApp'
            },
            body: ssml
        });

        if (!response.ok) {
            throw new Error(`Azure API error: ${response.status} ${response.statusText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        console.log('Audio received, length:', audioBuffer.byteLength);

        res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.byteLength
        });

        res.end(Buffer.from(audioBuffer));

    } catch (error) {
        console.error('TTS error:', error);
        res.status(500).json({
            error: 'Text-to-speech failed',
            details: error.message
        });
    }
});

// Update the chat endpoint to include the formatted timeout message
app.get('/api/chat', (req, res) => {
    // Keep track of connection state
    let isConnected = false;
    let connectionAttempts = 0;
    const maxAttempts = 5;

    console.log('\n━━━━━━━━━━━ SSE Connection Request ━━━━━━━━━━━');
    console.log('Time:', new Date().toLocaleTimeString());
    console.log('Client:', req.headers['user-agent']);
    console.log('Session:', req.query.sessionId);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial connection success message
    res.write(`data: ${JSON.stringify({ type: 'connection', status: 'established' })}\n\n`);
    isConnected = true;

    // Set up heartbeat interval with animation
    let heartPhase = 0;  // 0: empty, 1: red, 2: light red
    const heartbeatInterval = setInterval(() => {
        if (!isConnected) {
            console.log('Attempting to restore connection...');
            connectionAttempts++;
            if (connectionAttempts > maxAttempts) {
                console.log('Max reconnection attempts reached');
                clearInterval(heartbeatInterval);
                return;
            }
        }

        const hearts = ['♡', '❤️', '💗'];  // empty, red, light red
        const heart = hearts[heartPhase];
        process.stdout.write(`\r\u001b[?25l`);  // Windows-compatible cursor hide
        process.stdout.write(`Heartbeat ${new Date().toLocaleTimeString()}  ${heart}                \u001b[?25l`);
        heartPhase = (heartPhase + 1) % 3;  // Cycle through 3 phases

        try {
            res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
            isConnected = true;
            connectionAttempts = 0;
        } catch (error) {
            console.log('Heartbeat error:', error.message);
            isConnected = false;
        }
    }, 500);

    // Add cleanup on connection close
    req.on('close', () => {
        process.stdout.write(`\u001b[?25h`);  // Windows-compatible cursor show
        process.stdout.write('\n');
        console.log('\n━━━━━━━━━━━ SSE Connection Closed ━━━━━━━━━━━');
        console.log('Time:', new Date().toLocaleTimeString());
        console.log('Session:', req.query.sessionId);
        console.log('Final connection state:', { isConnected, attempts: connectionAttempts });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        clearInterval(heartbeatInterval);
    });
});

// Chat endpoint with hierarchical query handling
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, model, systemPrompt, timezone } = req.body;
        const startTime = Date.now();

        // 1. First check for greetings, using simplified patterns for server-side checks
        if (chatPatterns.greetings.some(pattern => pattern.test(message.toLowerCase()))) {
            // Handle greetings...
            return;
        }

        // 2. Then check for time/date queries
        const isTimeQuery = chatPatterns.time.some(pattern => pattern.test(message.toLowerCase()));
        const isDateQuery = chatPatterns.date.some(pattern => pattern.test(message.toLowerCase()));
        const isDateTimeQuery = chatPatterns.dateTime.some(pattern => pattern.test(message.toLowerCase()));

        if (isTimeQuery || isDateQuery || isDateTimeQuery) {
            const now = new Date();
            const formattedTime = formatTimeDateStr(now, timezone);
            const timeOfDay = getTimeOfDay(timezone);
            let response;

            if (isTimeQuery) {
                const minutes = now.getMinutes();
                response = `The current time is ${formattedTime.timeStr}. ` +
                          `${formatMinutesPlural(minutes)} past ${now.getHours() % 12 || 12}`;
            } else if (isDateQuery) {
                response = `Today is ${formattedTime.dateStr}`;
            } else {
                response = `It is ${formattedTime.timeStr} on ${formattedTime.dateStr}`;
            }

            // Check for holidays
            const holiday = getHoliday(now);
            if (holiday) {
                response += `. By the way, ${holiday.greeting}`;
            }

            res.json({ success: true, response });
            return;
        }

        // 3. ONLY check for EXACT web search commands
        const isExplicitWebSearch = /^(web search|bing search|internet search)\s/i.test(message);

        if (isExplicitWebSearch) {
            // Extract the actual search query by removing the command
            const searchQuery = message.replace(/^(web search|bing search|internet search)\s+/i, '');

            try {
                const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
                    headers: {
                        'Ocp-Apim-Subscription-Key': process.env.BING_SUBSCRIPTION_KEY
                    },
                    params: {
                        q: searchQuery,
                        count: 5,
                        responseFilter: ['Webpages', 'News'],
                        mkt: 'en-US'
                    }
                });

                let formattedResults = formatBingResults(response.data);
                res.write(`data: ${JSON.stringify({ response: formattedResults })}\n\n`);
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                res.end();
                return;
            } catch (error) {
                console.error('Bing Search error:', error);
            }
        }

        // 4. For ALL other queries (including "tell me about"), use SLM
        console.log(`Using ${model} model`);

        if (model === 'gpt-4o-mini') {
            console.log('Using gpt-4o-mini model');

            // Set headers only once at the beginning
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...(Array.isArray(history) ? history : []),
                    { role: "user", content: message }
                ],
                stream: true
            });

            // call the model handler for gpt-4o-mini making sure to pass startTime
            await handleGPT4oMiniResponse(completion, res, message, startTime);

        } else if (model === 'phi-3-mini-4k-instruct') {
            // call the model handler for phi-3-mini-4k-instruct making sure to pass startTime
            await handlePhi3Mini4kInstructResponse(completion, res, message, startTime);
        }

    } catch (error) {
        console.error('Error in chat endpoint:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// Image analysis endpoint
app.post('/api/analyze-image', async (req, res) => {
    try {
        const { image, prompt, systemPrompt } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        // Validate image data
        if (!image.startsWith('data:image')) {
            return res.status(400).json({ error: 'Invalid image format' });
        }

        const startTime = Date.now();
        let tokenCount = 0;

        // Set up SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Process with Vision API
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt || "Analyze the following image in detail." },
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt || "What's in this image?" },
                        {
                            type: "image_url",
                            image_url: {
                                url: image,
                                detail: "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens: 500,
            stream: true,
        });

        // Stream the response
        for await (const chunk of response) {
            if (chunk.choices[0]?.delta?.content) {
                const content = chunk.choices[0].delta.content;
                tokenCount += Math.ceil(content.length / 4);

                const data = {
                    response: content,
                    metrics: {
                        duration: Date.now() - startTime,
                        promptTokens: Math.ceil(prompt?.length / 4) || 0,
                        completionTokens: tokenCount,
                        totalTokens: (Math.ceil(prompt?.length / 4) || 0) + tokenCount,
                        model: "gpt-4o",
                        startTime: startTime,
                        endTime: Date.now()
                    }
                };

                console.log('Sending chunk metrics:', data.metrics);
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            }
        }

        // Send final completion signal with metrics
        const finalData = {
            done: true,
            metrics: {
                duration: Date.now() - startTime,
                promptTokens: Math.ceil(prompt?.length / 4) || 0,
                completionTokens: tokenCount,
                totalTokens: (Math.ceil(prompt?.length / 4) || 0) + tokenCount,
                model: "gpt-4o",
                startTime: startTime,
                endTime: Date.now()
            }
        };

        console.log('Sending final metrics:', finalData.metrics);
        res.write(`data: ${JSON.stringify(finalData)}\n\n`);
        res.end();

    } catch (error) {
        console.error('Error analyzing image:', error);
        res.status(500).json({ error: 'Failed to analyze image', details: error.message });
    }
});

// Update the datetime endpoint
app.post('/api/datetime', async (req, res) => {
    const { timezone = 'America/Los_Angeles', type } = req.body;
    const now = new Date();

    try {
        const timeOptions = {
            timeZone: timezone,
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
        };

        const dateOptions = {
            timeZone: timezone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };

        const currentTime = now.toLocaleTimeString('en-US', timeOptions);
        const currentDate = now.toLocaleDateString('en-US', dateOptions);

        // Check for holiday
        const holiday = getHoliday(now);

        let response;
        if (holiday) {
            // For date only
            if (type === 'date') {
                response = `Today's date is ${currentDate}. This day being a special holiday... I wish you a... ${holiday.greeting}`;
            }
            // For time only
            else if (type === 'time') {
                response = `The current time is ${currentTime} ${timezone}. By the way, today is ${holiday.name}, so ${holiday.greeting}`;
            }
            // For both date and time
            else {
                response = `Today's date is ${currentDate} and the local time is ${currentTime} ${timezone}. This day being a special holiday, I wish to say have a... ${holiday.greeting}`;
            }
        } else {
            // Regular responses without holiday
            if (type === 'date') {
                response = `Today's date is ${currentDate}`;
            } else if (type === 'time') {
                response = `The current time is ${currentTime} ${timezone}`;
            } else {
                response = `Today's date is ${currentDate} and the local time is ${currentTime} ${timezone}`;
            }
        }

        res.json({
            response: response,
            messageType: type,
            metrics: {
                model: 'datetime',
                duration: `${new Date().toLocaleTimeString()} PST`
            }
        });

    } catch (error) {
        console.error('DateTime error:', error);
        res.status(500).json({
            error: 'Failed to get date/time information',
            details: error.message
        });
    }
});

// =====================================================
// JOKE API ENDPOINTS
// =====================================================

// List jokes endpoint (should come before /:title)
app.get('/api/jokes/list', async (req, res) => {
    try {
        const { view, userId } = req.query;
        console.log('List jokes request:', { view, userId });

        // First check if we need to migrate jokes from old session
        const oldJokes = await mongoose.connection.collection('my_jokes')
            .find({ userId: 'session-1736122120855-er7bz6n' })
            .toArray();

        // If we found jokes with old session ID, migrate them
        if (oldJokes.length > 0) {
            console.log('Found old jokes, migrating to new session:', userId);
            await Promise.all(oldJokes.map(joke =>
                mongoose.connection.collection('my_jokes').updateOne(
                    { _id: joke._id },
                    { $set: { userId: userId } }
                )
            ));
        }

        // Now query with the current session ID
        let query = view === 'all' ? {} : { userId };
        console.log('Final MongoDB query:', query);

        const jokes = await mongoose.connection.collection('my_jokes')
            .find(query)
            .sort({ dateCreated: -1 })
            .toArray();

        console.log('Found jokes:', {
            count: jokes.length,
            userSpecific: view !== 'all',
            query,
            jokes: jokes.map(j => ({ title: j.title, userId: j.userId }))
        });

        res.json({ success: true, jokes: jokes || [] });
    } catch (error) {
        console.error('Error listing jokes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Save joke endpoint
app.post('/api/jokes', async (req, res) => {
    try {
        const { title, content, userId } = req.body;
        console.log('Save joke request:', { title, userId });

        const joke = new Joke({
            title,
            content,
            userId,
            dateCreated: new Date()
        });

        await joke.save();
        res.json({ success: true, joke });
    } catch (error) {
        console.error('Error saving joke:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get specific joke endpoint (should come after /list)
app.get('/api/jokes/:title', async (req, res) => {
    try {
        const { title } = req.params;
        const { sessionId } = req.query;
        console.log('Get joke request:', { title, sessionId });

        const joke = await Joke.findOne({
            title: new RegExp(title, 'i'),
            userId: sessionId
        });

        res.json({ success: true, joke });
    } catch (error) {
        console.error('Error retrieving joke:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete a joke
app.delete('/api/jokes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Delete joke request:', { id });

        await Joke.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting joke:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update a joke
app.put('/api/jokes/:title', async (req, res) => {
    try {
        const { title } = req.params;
        const { content, userId } = req.body;
        const joke = await Joke.findOneAndUpdate(
            { title: new RegExp(title, 'i'), userId },
            { content },
            { new: true }
        );
        res.json({ success: true, joke });
    } catch (error) {
        console.error('Error updating joke:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Search jokes
app.get('/api/jokes/search', async (req, res) => {
    try {
        const { term } = req.query;
        const jokes = await Joke.find({
            $or: [
                { title: new RegExp(term, 'i') },
                { content: new RegExp(term, 'i') }
            ]
        });
        res.json({ success: true, jokes });
    } catch (error) {
        console.error('Error searching jokes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// =====================================================
// MODEL HANDLERS
// =====================================================

// GPT-4o-mini model handler
async function handleGPT4oMiniResponse(response, res, message, startTime) {
    console.log('Starting GPT-4o-mini response handling');

    // const startTime = Date.now();
    let tokenCount = 0;
    let fullResponse = '';
    let currentParagraph = '';
    let lastSentContent = '';
    let isEnded = false;

    try {
        for await (const chunk of response) {
            if (isEnded) break;

            // Add debug logging
            console.log('Received chunk:', JSON.stringify(chunk));

            // Check if chunk and choices exist before accessing
            if (!chunk || !chunk.choices || !Array.isArray(chunk.choices) || chunk.choices.length === 0) {
                console.warn('Invalid chunk format:', chunk);
                continue;
            }

            if (chunk.choices[0]?.delta?.content) {
                const content = chunk.choices[0].delta.content;
                fullResponse += content;
                currentParagraph += content;

                // Update token count
                tokenCount += Math.ceil(content.length / 4);

                // Check for special markers or line breaks
                if (content.includes('[/P1]') ||
                   content.includes('[/P2]') ||
                   content.includes('[/P3]') ||
                   content.includes('[/IMG]') ||
                   content.includes('\n\n')) {

                   // Clean up markers and add proper spacing
                   let cleanParagraph = currentParagraph
                       .replace(/\[P1\]|\[P2\]|\[P3\]|\[IMG\]|\[\/P1\]|\[\/P2\]|\[\/P3\]|\[\/IMG\]/g, '')
                       .trim();

                    if (cleanParagraph && cleanParagraph !== lastSentContent) {
                        if (!res.writableEnded) {
                            res.write(`data: ${JSON.stringify({
                                response: cleanParagraph + '\n\n',
                                tokenCount: tokenCount,
                                metrics: {
                                    duration: Date.now() - startTime,
                                    promptTokens: Math.ceil(fullResponse.length / 4),
                                    completionTokens: tokenCount,
                                    totalTokens: Math.ceil(fullResponse.length / 4) + tokenCount,
                                    model: 'gpt-4o-mini'
                                }
                            })}\n\n`);
                        }
                        lastSentContent = cleanParagraph;
                        currentParagraph = '';
                    }
                }
            }
        }

        // Send any remaining content and final metrics
        if (currentParagraph.trim() && currentParagraph.trim() !== lastSentContent) {
            if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify({
                    response: currentParagraph.trim(),
                    tokenCount: tokenCount,
                    metrics: {
                        duration: Date.now() - startTime,
                        promptTokens: Math.ceil(fullResponse.length / 4),
                        completionTokens: tokenCount,
                        totalTokens: Math.ceil(fullResponse.length / 4) + tokenCount,
                        model: 'gpt-4o-mini'
                    }
                })}\n\n`);
            }
        }

        // Send final completion signal
        if (!res.writableEnded) {
            console.log('Sending completion signal');
            res.write(`data: ${JSON.stringify({
                done: true,
                complete: true,  // Additional flag for completion
                response: null,  // Indicate no more content
                metrics: {
                    duration: Date.now() - startTime,
                    promptTokens: Math.ceil(message.length / 4),
                    completionTokens: tokenCount,
                    totalTokens: Math.ceil(message.length / 4) + tokenCount,
                    model: 'gpt-4o-mini'
                }
            })}\n\n`);

            // // Reset processing state
            // state.isProcessing = false;

            // // If in conversation mode and not speaking, restart listening
            // if (state.isConversationMode && !state.isAISpeaking) {
            //     console.log('Restarting listening after completion');
            //     setTimeout(() => {
            //         if (!state.isAISpeaking && !state.isProcessing) {
            //             startListening();
            //             updateStatus('Listening...');
            //         }
            //     }, 1000);
            // }

            // // Remove processing alert
            // document.querySelector('.processing-alert')?.remove();

            res.end();
            isEnded = true;
        }
    } catch (error) {
        console.error('Error in handleGPT4oMiniResponse:', error);
        // state.isProcessing = false;  // Reset processing state even on error
        document.querySelector('.processing-alert')?.remove();

        if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({
                error: error.message,
                done: true,
                complete: true
            })}\n\n`);
            res.end();
        }
        throw error;
    }
}

// Phi-3-mini-4k-instruct model handler
async function handlePhi3Mini4kInstructResponse(response, res) {
    console.log('Using Phi-3-mini-4k-instruct model');
    const startTime = Date.now();

    try {
        let lastMessage = '';
        // Get the last message from the stream
        for await (const chunk of response) {
            if (chunk.choices[0]?.delta?.content) {
                lastMessage = chunk.choices[0].delta.content;
            }
        }

        let fullPrompt;
        if (lastMessage.toLowerCase().includes('tell me a joke') ||
            lastMessage.toLowerCase().includes('another joke')) {
            fullPrompt = `${systemPrompt}\n\nHuman: Tell me a short, funny joke.\n\nAssistant:`;
        } else {
            fullPrompt = `${systemPrompt}\n\nHuman: ${lastMessage}\n\nAssistant:`;
        }

        // Rest of your existing Phi-3 handler stays EXACTLY the same
        const fetchPhi3Response = async () => {
            const response = await axios.post(
                "https://api-inference.huggingface.co/models/microsoft/phi-3-mini-4k-instruct",
                {
                    inputs: fullPrompt,
                    parameters: {
                        max_new_tokens: 100,
                        temperature: 0.9,
                        top_p: 0.95,
                        return_full_text: false,
                        do_sample: true
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );
            return response.data;
        };

        const data = await fetchPhi3Response();
        console.log('Raw API response:', JSON.stringify(data, null, 2));

        if (!data[0] || !data[0].generated_text) {
            throw new Error('Unexpected response format from Hugging Face API');
        }

        let aiResponse = data[0].generated_text.trim();

        // Remove everything after the first occurrence of "Human:" or "Assistant:"
        aiResponse = aiResponse.split(/Human:|Assistant:/)[0].trim();

        // For joke requests, ensure we're sending a complete joke
        if (lastMessage.toLowerCase().includes('tell me a joke') ||
            lastMessage.toLowerCase().includes('another joke')) {
            const jokeLines = aiResponse.split('\n').filter(line => line.trim() !== '');
            if (jokeLines.length >= 2) {
                aiResponse = jokeLines[0] + '\n' + jokeLines[1];  // Keep setup and punchline
            } else if (jokeLines.length === 1) {
                aiResponse = jokeLines[0];  // Keep the single line joke
            } else {
                aiResponse = "Sorry, I couldn't come up with a joke this time.";
            }
        }

        console.log('Processed AI response:', aiResponse);

        // Send the processed response
        res.write(`data: ${JSON.stringify({ response: aiResponse })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, duration: Date.now() - startTime, model: 'phi-3-mini-4k-instruct' })}\n\n`);

        console.log(`Phi-3 response time: ${Date.now() - startTime}ms`);
    } catch (error) {
        console.error('Error in Phi-3 response:', error);
        res.write(`data: ${JSON.stringify({ error: 'An error occurred while fetching the Phi-3 response', details: error.message })}\n\n`);
    }
}


// =====================================================
// SEARCH ENDPOINTS
// =====================================================

// =====================================================
// GOOGLE IMAGE SEARCH ENDPOINT
// =====================================================

// Google Image Search endpoint
app.get('/api/google-image-search', async (req, res) => {
    try {
        const searchQuery = req.query.q;
        if (!searchQuery) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const response = await axios.get(`https://www.googleapis.com/customsearch/v1`, {
            params: {
                key: process.env.GOOGLE_API_KEY,
                cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
                q: searchQuery,
                searchType: 'image',
                num: 10  // Increased to 10 images
            }
        });

        const images = response.data.items.map(item => ({
            link: item.link,
            title: item.title,
            thumbnail: item.image?.thumbnailLink
        }));

        res.json({ images });
    } catch (error) {
        console.error('Error in Google Image Search:', error);
        res.status(500).json({ error: 'Failed to fetch images', details: error.message });
    }
});


// =====================================================
// BING SEARCH ENDPOINT
// =====================================================

// Update the BING_SEARCH_PROMPT for better formatting guidance
const BING_SEARCH_PROMPT = `
Format search results with consistent spacing and clear separation:

1. Title line: "# Web Results for [query]"
2. Each result:
   - Numbered item (1., 2., etc.)
   - Title on first line
   - Content indented with 3 spaces
   - Blank line after content
   - Published date indented with 3 spaces
   - Separator line (---)
   - Double newline between results
`;

// Add function to extract search intent using the prompt
async function extractSearchIntent(query) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `${BING_SEARCH_PROMPT}\n\nExtract the precise search intent from user queries.
                    Maintain important qualifiers like 'latest', 'current', or 'recent'.
                    Remove only filler words and search commands.
                    Example: 'show me a web search for latest advances in AI' → 'latest advances in AI'
                    Example: 'tell me about current developments in quantum computing' → 'current developments in quantum computing'`
                },
                {
                    role: "user",
                    content: `Extract the core search topic from: "${query}"`
                }
            ],
            max_tokens: 50,
            temperature: 0
        });
        return completion.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error extracting search intent:', error);
        return cleanSearchQuery(query);  // Fallback to basic cleaning
    }
}

// Update the Bing Search endpoint to use extractSearchIntent
app.post('/api/bing-search', async (req, res) => {
    const requestStartTime = Date.now();  // Track request start time
    const { query } = req.body;

    try {
        const cleanQuery = await extractSearchIntent(query);
        const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
            headers: {
                'Ocp-Apim-Subscription-Key': process.env.BING_SUBSCRIPTION_KEY
            },
            params: {
                q: cleanQuery,
                count: 5,
                responseFilter: ['Webpages', 'News'],
                mkt: 'en-US'
            }
        });

        let formattedResults = '';

        if (response.data.webPages?.value) {
            formattedResults += `# Web Results for "${cleanQuery}"\n\n`;
            response.data.webPages.value.forEach((result, index) => {
                // Extract domain name for source
                const sourceDomain = new URL(result.url).hostname.replace('www.', '');

                formattedResults += `${index + 1}. <a href="${result.url}" target="_blank">${result.name}</a>\n\n` +
                    `   ${result.snippet}\n\n` +
                    `   <div class="search-metadata">\n` +
                    `      <div class="metadata-item" data-label="Source:">${sourceDomain}</div>\n` +
                    `      <div class="metadata-item" data-label="URL:"><a href="${result.url}" target="_blank">${result.url}</a></div>\n` +
                    `      <div class="metadata-item" data-label="Last Updated:">${new Date(result.dateLastCrawled).toLocaleDateString()}</div>\n` +
                    `   </div>\n\n` +
                    `---\n\n`;
            });
        }

        if (response.data.news?.value) {
            formattedResults += `# News Results for "${cleanQuery}"\n\n`;
            response.data.news.value.forEach((result, index) => {
                formattedResults += `${index + 1}. <a href="${result.url}" target="_blank">${result.name}</a>\n\n` +
                    `   ${result.description}\n\n` +
                    `   <div class="search-metadata">\n` +
                    `      <div class="metadata-item" data-label="Source:">${result.provider[0]?.name || 'Unknown'}</div>\n` +
                    `      <div class="metadata-item" data-label="URL:">${result.url}</div>\n` +
                    `      <div class="metadata-item" data-label="Published:">${new Date(result.datePublished).toLocaleDateString()}</div>\n` +
                    `   </div>\n\n` +
                    `---\n\n`;
            });
        }

        // Calculate duration at the end
        const requestDuration = (Date.now() - requestStartTime) / 1000;

        res.json({
            response: formattedResults,
            metrics: {
                model: 'bing-search',
                duration: `${requestDuration.toFixed(2)}s`,
                totalTokens: formattedResults.length,
                startTime: requestStartTime,
                endTime: Date.now()
            }
        });

    } catch (error) {
        const requestDuration = (Date.now() - requestStartTime) / 1000;
        console.error('Bing Search error:', error);
        res.status(500).json({
            error: 'Failed to perform Bing search',
            metrics: {
                model: 'bing-search',
                duration: `${requestDuration.toFixed(2)}s`,
                startTime: requestStartTime,
                endTime: Date.now()
            }
        });
    }
});



// =====================================================
// PERSONAL INFO ENDPOINTS
// =====================================================

// Session configuration
const PERSISTENT_SESSION = {
    id: 'persistent-storage-001',
    version: 'v1',
    type: 'global',
    created: new Date().toISOString()
};

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
// RECIPE ENDPOINT
// =====================================================

// Add new recipe endpoint
app.post('/api/recipe', async (req, res) => {
    try {
        const { text } = req.body;

        // Extract recipe name - simpler pattern
        const recipeMatch = text.match(/([A-Z][A-Z\s]+)(?=Here is|$)/);

        if (recipeMatch) {
            const recipeName = recipeMatch[1]
                .replace(/\s+/g, ' ')  // Clean up spaces
                .trim();  // Just trim, already in uppercase

            console.log('Recipe name extracted:', recipeName);

            // Send back formatted recipe data
            res.json({
                success: true,
                recipe: {
                    name: recipeName,
                    text: text
                }
            });
        } else {
            // Try alternate pattern if first one fails
            const altMatch = text.match(/^([A-Z][A-Z\s]+)/);
            if (altMatch) {
                const recipeName = altMatch[1].replace(/\s+/g, ' ').trim();
                console.log('Recipe name extracted (alt):', recipeName);
                res.json({
                    success: true,
                    recipe: {
                        name: recipeName,
                        text: text
                    }
                });
                return;
            }
            console.error('Failed to match recipe pattern in text:', text.substring(0, 100));
            res.status(400).json({
                success: false,
                error: 'Could not parse recipe format'
            });
        }
    } catch (error) {
        console.error('Error in recipe endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process recipe'
        });
    }
});


// =====================================================
// MONGO DB CONNECTION AND SCHEMAS
// =====================================================

// Define schema first
const personalInfoSchema = new mongoose.Schema({
    userId: String,
    sessionId: String,
    sessionType: String,
    sessionVersion: String,
    type: String,
    value: String,
    timestamp: { type: Date, default: Date.now },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now }
}, {
    collection: 'conversation_history',
    strict: false  // Allow flexibility with existing data
});

// Joke Schema
const jokeSchema = new mongoose.Schema({
    title: String,
    content: String,
    userId: String,
    dateCreated: { type: Date, default: Date.now }
}, {
    collection: 'my_jokes'  // Specify collection name
});

// Add index for faster lookups
personalInfoSchema.index({ sessionId: 1, type: 1 });
// Add index for joke lookups
jokeSchema.index({ userId: 1, title: 1 });

// Create model
const PersonalInfo = mongoose.model('PersonalInfo', personalInfoSchema);
const Joke = mongoose.model('Joke', jokeSchema);

// Single MongoDB connection
let retryCount = 0;
const maxRetries = 3;

async function connectWithRetry() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected successfully to:', {
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name,
            collections: await mongoose.connection.db.listCollections().toArray()
        });
    } catch (err) {
        console.error('MongoDB connection error:', {
            error: err.message,
            attempt: retryCount + 1,
            maxRetries
        });

        if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying connection in 5 seconds... (Attempt ${retryCount}/${maxRetries})`);
            setTimeout(connectWithRetry, 5000);
        }
    }
}

// Initial connection
connectWithRetry();

// Single MongoDB connection
mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('MongoDB connected successfully to:', {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
    });
    conversationCollection = mongoose.connection.collection('conversation_history');
}).catch(err => {
    console.error('MongoDB connection error:', {
        error: err.message,
        code: err.code,
        uri: process.env.MONGODB_URI?.replace(/\/\/.*@/, '//***:***@')
    });
});

// Handle disconnection
mongoose.connection.on('disconnected', () => {
    console.log('MongoDB connected successfully to:', {
        status: 'disconnected',
        time: new Date().toISOString()
    });
    if (retryCount < maxRetries) {
        connectWithRetry();
    }
});


// =====================================================
// MONGO DB TEST ROUTES
// =====================================================

// Add test route for database connection
app.get('/api/db-test', async (req, res) => {
    try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        const dbStats = await mongoose.connection.db.stats();
        res.json({
            connected: mongoose.connection.readyState === 1,
            database: mongoose.connection.name,
            collections: collections.map(c => c.name),
            stats: dbStats
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Add cleanup route (only for development) for MongoDB collection to CLEAR the database
app.post('/api/cleanup', async (req, res) => {
    try {
        // Drop the collection for conversation history
        await mongoose.connection.collection('conversation_history').deleteMany({});

        console.log('Database cleanup completed:', {
            database: mongoose.connection.name,
            collections: ['conversation_history'],
            status: 'cleared'
        });

        res.json({
            success: true,
            message: 'All collections cleared',
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add debug endpoint to check database state
app.get('/api/debug/db-state', async (req, res) => {
    try {
        const dbState = {
            connection: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
            collections: await mongoose.connection.db.listCollections().toArray(),
            jokeCount: await Joke.countDocuments(),
            recentJokes: await Joke.find().sort({dateCreated: -1}).limit(5)
        };
        res.json(dbState);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this test joke endpoint
app.post('/api/debug/add-test-joke', async (req, res) => {
    try {
        const testJoke = new Joke({
            title: 'Test Joke',
            content: 'Why did the programmer quit his job? Because he didn\'t get arrays!',
            userId: req.query.userId || 'test-user',
            dateCreated: new Date()
        });

        await testJoke.save();
        res.json({ success: true, joke: testJoke });
    } catch (error) {
        console.error('Error adding test joke:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// =====================================================
// YOUTUBE API ENDPOINTS
// =====================================================

app.post('/api/youtube/search', async (req, res) => {
    try {
        const { query, type = 'search' } = req.body;
        console.log('YouTube search request:', { query, type });

        // Check if API key exists
        if (!process.env.GOOGLE_API_KEY) {
            console.error('Google API key is missing in environment variables');
            throw new Error('Google API key is not configured');
        }

        // Log the API key presence (safely)
        console.log('Google API key status:', {
            exists: !!process.env.GOOGLE_API_KEY,
            length: process.env.GOOGLE_API_KEY?.length,
            prefix: process.env.GOOGLE_API_KEY?.substring(0, 5) + '...'
        });

        if (type === 'search') {
            // First get the video IDs
            const searchResponse = await youtube.search.list({
                auth: process.env.GOOGLE_API_KEY,
                part: ['snippet'],
                q: query,
                maxResults: 10,
                type: 'video'
            });

            // Then get full video details including complete descriptions
            const videoIds = searchResponse.data.items.map(item => item.id.videoId);
            console.log('Fetching full details for videos:', videoIds);

            const videoDetails = await youtube.videos.list({
                auth: process.env.GOOGLE_API_KEY,
                part: ['snippet', 'contentDetails'],
                id: videoIds.join(',')
            });

            const videos = videoDetails.data.items.map(video => ({
                id: video.id,
                title: video.snippet.title,
                description: video.snippet.description,
                channelTitle: video.snippet.channelTitle,
                publishedAt: video.snippet.publishedAt,
                duration: video.contentDetails.duration
            }));

            res.json({ success: true, videos });
        } else if (type === 'play') {
            // Handle single video playback
            const searchResponse = await youtube.search.list({
                auth: process.env.GOOGLE_API_KEY,
                part: ['snippet'],
                q: query,
                maxResults: 1,
                type: 'video'
            });

            if (searchResponse.data.items.length > 0) {
                const video = searchResponse.data.items[0];
                res.json({
                    success: true,
                    video: {
                        id: video.id.videoId,
                        title: video.snippet.title
                    }
                });
            } else {
                res.json({ success: false, message: 'No videos found' });
            }
        }
    } catch (error) {
        console.error('YouTube API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// =====================================================
// SERVER LISTENER
// =====================================================

// Call the server and port
app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening at http://localhost:${port}`);
}).on('error', (error) => {
    console.error('Error starting server:', error);
    if (error.code === 'EACCES') {
        console.error('Permission denied. Try using a port number above 1024.');
    } else if (error.code === 'EADDRINUSE') {
        console.error('Port is already in use. Try a different port.');
    }
});



// =====================================================
// END OF Server.js FILE v20.0.0
// =====================================================