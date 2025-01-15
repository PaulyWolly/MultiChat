# AI Chat Application with Memory and Voice Interaction
#### v20.0.5
![GitHub release (latest by date)](https://img.shields.io/github/v/release/PaulyWolly/MultiChat@20.0.2)

## Overview
A sophisticated AI chat application featuring voice interaction, persistent memory storage, and multi-modal communication capabilities. Built with Node.js, Express, MongoDB, and modern web technologies.

## Core Features

### 1. Session Management
#### Structured Session IDs
- Structured session handling using persistent IDs
- Format: `{type}-{id}-{version}` (e.g., `global-persistent-storage-001-v1`)
- Session validation and verification
- Support for multiple session types (global, user, admin)

### 2. Memory System
#### Hierarchical Storage
- Short-term memory (SLM) for immediate context
- localStorage for quick client-side access
- MongoDB for persistent long-term storage
- Automatic data synchronization between layers

#### Memory Categories
- Personal Information (name, preferences)
- Secret Words
- Favorites
- General Memories
- Timestamps and versioning for all stored data

### 3. Voice Interaction
#### Speech Recognition
- Real-time voice input processing
- Continuous listening mode
- Command recognition
- Error handling and recovery

#### Text-to-Speech (TTS)
- Azure TTS integration
- Multiple voice options
- Queue-based audio playback
- Interrupt and resume capabilities

### 4. Conversation Management
- Inactivity detection and timeout
- Conversation mode toggle
- Context preservation
- Exit command handling

### 5. User Interface
- Clean, responsive design
- Real-time status updates
- Audio controls
- Model selection
- Voice selection
- Microphone toggle

## Technical Features

### 1. API Integration
- OpenAI GPT integration
- Azure Speech Services
- Google Image Search
- Bing Search capabilities

### 2. Database Structure

```bash
  PersonalInfo Schema:
  {
  userId: String,
  sessionId: String,
  sessionType: String,
  sessionVersion: String,
  type: String,
  value: String,
  timestamp: Date,
  created: Date,
  updated: Date
  }
```
```bash
Memory Keywords:
Secret Word: /(?:the )?secret word (?:is|=) (.+)/i
Favorites: /(?:my )?favorite (\w+) (?:is|=) (.+)/i
Remember: /remember (?:that )?(.+)/i
```
### 4. Error Handling
- Speech recognition error recovery
- Network failure handling
- Invalid session detection
- Data validation
- Audio playback error management

## API Endpoints

### Personal Information

GET /api/personal-info/:type
POST /api/personal-info
GET /api/personal-info/all

### Voice Services

GET /api/google-image-search
POST /api/bing-search

### Search Services

## Environment Configuration
Required environment variables:
- `MONGODB_URI`
- `SPEECH_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`
- `GOOGLE_SEARCH_ENGINE_ID`

## Usage Examples

### 1. Setting Information

```bash
// Store a secret word
"The secret word is nebula"
// Set user name
"My name is Paul"
// Store a favorite
"My favorite color is blue"
```

### 2. Retrieving Information

```bash
// Get secret word
"What is the secret word?"
// Get name
"What is my name?"
// Get a favorite
"What is my favorite color?"
```


## State Management
The application maintains various states:
- Audio playback state
- Speech recognition state
- Processing state
- Conversation mode state
- Session state
- Memory state

## Security Features
- Session validation
- Input sanitization
- API key protection
- Error message sanitization
- Rate limiting (TODO)

## Future Enhancements (TODO)
- User authentication
- Multiple session support
- Enhanced error recovery
- Data migration tools
- Memory expiration
- Rate limiting
- Enhanced security features

## Dependencies
- express
- cors
- mongoose
- axios
- microsoft-cognitiveservices-speech-sdk
- openai
- dotenv

## Development

```bash
Install dependencies
npm install
Start the server
npm start
Default port: 3335
```


## Browser Support
- Chrome (recommended)
- Firefox
- Safari
- Edge

## Notes
- Speech recognition requires HTTPS in production
- Some features require specific browser permissions
- Local storage must be enabled
- Stable internet connection required for API features
