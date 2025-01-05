/*
  SERVER.js
  Version: 3
  AppName: Multi-Chat [v3]
  Created by Paul Welby
  updated: December 8, 2024 @10:00AM
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

// Load environment variables FIRST
dotenv.config();

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Express
const app = express();

// Set the port
const port = process.env.PORT || 3030;

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
            searchTerms: /^(web search|bing search|internet search)\s/i,
            // newsTerms: /(?:news|latest|recent|current|update|updates)/i,
            // trendingTerms: /(?:trending|popular|viral|hot|buzz|top|best|most)/i,
            // timeQualifiers: /(?:today|this week|this month|this year|2024|upcoming|future)/i,
            // informationTypes: /(?:information|details|facts|data|research|developments|advancements|breakthroughs)/i,
            // questionWords: /(?:who|what|when|where|why|how|did|does|is|are|can|will|should)/i,
            // topics: /(?:technology|science|AI|artificial intelligence|machine learning|ML|computing|digital|tech)/i,
            // actions: /(?:find|search|look up)/i
        }
    };
}

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
        const sessionId = `${PERSISTENT_SESSION.type}-${PERSISTENT_SESSION.id}-${PERSISTENT_SESSION.version}`;

        console.log('Attempting to store personal info:', {
            type,
            value,
            sessionId,
            database: mongoose.connection.name,
            connected: mongoose.connection.readyState === 1
        });

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
            collection: info.collection.name,
            database: mongoose.connection.db.databaseName
        });
        res.json({ success: true, value });
    } catch (error) {
        console.error('Error storing personal info:', {
            error: error.message,
            stack: error.stack,
            connectionState: mongoose.connection.readyState
        });
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
            details: error.message,
            responseData: error.response ? error.response.data : null,
            responseStatus: error.response ? error.response.status : null
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
app.get('/api/chat', async (req, res) => {
    const { sessionId } = req.query;

    // Set headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Handle client disconnect
    req.on('close', () => {
        console.log('Client disconnected, cleaning up:', sessionId);
        // Any cleanup needed
    });

    // Handle errors
    req.on('error', (error) => {
        console.log('SSE request error:', error);
        if (!res.writableEnded) {
            res.end();
        }
    });
});

// Chat endpoint with hierarchical query handling
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, model, systemPrompt, timezone } = req.body;
        const startTime = Date.now();
        const patterns = getPatterns();

        // 1. First check for greetings
        if (patterns.greetings.some(pattern => pattern.test(message.toLowerCase()))) {
            // Handle greetings...
            return;
        }

        // 2. Then check for time/date queries
        const isTimeQuery = patterns.time.some(pattern => pattern.test(message.toLowerCase()));
        const isDateQuery = patterns.date.some(pattern => pattern.test(message.toLowerCase()));
        const isDateTimeQuery = patterns.dateTime.some(pattern => pattern.test(message.toLowerCase()));

        if (isTimeQuery || isDateQuery || isDateTimeQuery) {
            // Handle time/date queries...
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

// Add index for faster lookups
personalInfoSchema.index({ sessionId: 1, type: 1 });

// Create model
const PersonalInfo = mongoose.model('PersonalInfo', personalInfoSchema);

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


