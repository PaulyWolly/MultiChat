export const patterns = {
    time: [
        /what time is it/i,
        /what(?:'s| is) the time/i,
        /what time do you have/i,
        /do you have the time/i,
        /what(?:'s| is) the local time/i
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
    date: [
        /what(?:'s| is) today'?s date/i,
        /what(?:'s| is) the date today/i,
        /do you have today'?s date/i,
        /what(?:'s| is) the date/i
    ],
    dateTime: [
        /what(?:'s| is) today'?s date and time/i,
        /what(?:'s| is) the date and time/i,
        /date and time today/i,
        /today'?s date and time/i
    ],
    // ... other patterns ...
};