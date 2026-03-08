import { getSupabase } from "../db.js";
import { queryFreeBusy, listUpcomingEvents as listEvents, } from "../integrations/google-calendar.js";
import { textResult } from "../types.js";
const DEFAULT_DAILY_LIMIT = 5;
async function countTodayActions(actionType) {
    const supabase = getSupabase();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabase
        .from("assistant_actions")
        .select("id", { count: "exact", head: true })
        .eq("action_type", actionType)
        .in("status", ["proposed", "approved", "executing", "executed"])
        .gte("created_at", todayStart.toISOString());
    return count ?? 0;
}
async function getDailyLimit(actionType) {
    const supabase = getSupabase();
    const today = new Date().toISOString().slice(0, 10);
    const { data: overrides } = await supabase
        .from("agent_memories")
        .select("content")
        .eq("type", "rule")
        .ilike("content", `%${actionType} limit override%${today}%`)
        .order("created_at", { ascending: false })
        .limit(1);
    if (overrides?.length) {
        const match = overrides[0].content.match(/override:\s*(\d+)/i);
        if (match)
            return parseInt(match[1], 10);
    }
    return DEFAULT_DAILY_LIMIT;
}
export const createCalendarEventDef = {
    name: "create_calendar_event",
    description: "Create an event on Google Calendar with attendees and send invitations.",
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
    const supabase = getSupabase();
    const countToday = await countTodayActions("create_calendar_event");
    const limit = await getDailyLimit("create_calendar_event");
    if (countToday >= limit) {
        return textResult({
            error: `Daily calendar event limit reached (${countToday}/${limit}). Ask Colin if he'd like to increase the limit for today.`,
        });
    }
    const { data: action, error } = await supabase
        .from("assistant_actions")
        .insert({
        request_id: _id,
        action_type: "create_calendar_event",
        payload: params,
        status: "proposed",
    })
        .select("id")
        .single();
    if (error)
        return textResult({ error: `Failed to queue calendar event: ${error.message}` });
    return textResult({
        status: "proposed",
        action_id: action?.id,
        message: "I've prepared the calendar event. Would you like me to create it?",
    });
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