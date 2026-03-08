import { createCalendarEvent, queryFreeBusy, listUpcomingEvents as listEvents, } from "../integrations/google-calendar.js";
import { textResult } from "../types.js";
export const createCalendarEventDef = {
    name: "create_calendar_event",
    description: "Create an event on Google Calendar with attendees and send invitations. IMPORTANT: Show the full event details (title, time, attendees) to the user first. Only call this tool after the user explicitly approves.",
    parameters: {
        type: "object",
        properties: {
            title: { type: "string", description: "Event title" },
            start: { type: "string", description: "Start time (ISO 8601)" },
            end: { type: "string", description: "End time (ISO 8601)" },
            attendees: { type: "array", items: { type: "string" }, description: "Attendee emails" },
            description: { type: "string", description: "Event description (optional)" },
        },
        required: ["title", "start", "end", "attendees"],
    },
};
export async function createCalendarEventExecute(_id, params) {
    try {
        const result = await createCalendarEvent({
            title: params.title,
            start: params.start,
            end: params.end,
            attendees: params.attendees,
            description: params.description,
        });
        return textResult({ created: true, ...result });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Calendar event failed: ${msg}` });
    }
}
export const getCalendarAvailabilityDef = {
    name: "get_calendar_availability",
    description: "Query Google Calendar free/busy for a set of attendees over a time range.",
    parameters: {
        type: "object",
        properties: {
            attendees: { type: "array", items: { type: "string" }, description: "Email addresses to check" },
            time_min: { type: "string", description: "Start of range (ISO 8601)" },
            time_max: { type: "string", description: "End of range (ISO 8601)" },
        },
        required: ["attendees", "time_min", "time_max"],
    },
};
export async function getCalendarAvailabilityExecute(_id, params) {
    try {
        const busy = await queryFreeBusy({
            attendees: params.attendees,
            timeMin: params.time_min,
            timeMax: params.time_max,
        });
        return textResult(busy);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Calendar query failed: ${msg}` });
    }
}
export const listUpcomingEventsDef = {
    name: "list_upcoming_events",
    description: "List the next upcoming events from Google Calendar.",
    parameters: {
        type: "object",
        properties: {
            max_results: { type: "number", description: "Maximum events to return (default 10)" },
        },
        required: [],
    },
};
export async function listUpcomingEventsExecute(_id, params) {
    try {
        const events = await listEvents(params.max_results ?? 10);
        return textResult(events);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Calendar query failed: ${msg}` });
    }
}
//# sourceMappingURL=calendar.js.map