export const patterns = {
    time: [
        /what time is it/i,
        /what(?:'s| is) the time/i,
        /what time do you have/i,
        /do you have the time/i,
        /what(?:'s| is) the local time/i
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