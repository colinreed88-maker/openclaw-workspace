import { google } from "googleapis";
function getAuth() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Google Calendar requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN");
    }
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
}
function getCalendar() {
    return google.calendar({ version: "v3", auth: getAuth() });
}
export async function createCalendarEvent(params) {
    const calendar = getCalendar();
    const event = {
        summary: params.title,
        description: params.description,
        start: { dateTime: params.start, timeZone: "America/New_York" },
        end: { dateTime: params.end, timeZone: "America/New_York" },
        attendees: params.attendees.map((email) => ({ email })),
        reminders: { useDefault: true },
    };
    const res = await calendar.events.insert({
        calendarId: params.calendarId ?? "primary",
        requestBody: event,
        sendUpdates: "all",
    });
    return {
        id: res.data.id,
        htmlLink: res.data.htmlLink,
        title: params.title,
        start: params.start,
        attendees: params.attendees,
        timestamp: new Date().toISOString(),
    };
}
export async function queryFreeBusy(params) {
    const calendar = getCalendar();
    const res = await calendar.freebusy.query({
        requestBody: {
            timeMin: params.timeMin,
            timeMax: params.timeMax,
            timeZone: "America/New_York",
            items: params.attendees.map((email) => ({ id: email })),
        },
    });
    const calendars = res.data.calendars ?? {};
    const busySlots = {};
    for (const [email, cal] of Object.entries(calendars)) {
        busySlots[email] = (cal.busy ?? []).map((b) => ({
            start: b.start ?? "",
            end: b.end ?? "",
        }));
    }
    return busySlots;
}
export async function listUpcomingEvents(maxResults = 10, calendarId = "primary") {
    const calendar = getCalendar();
    const res = await calendar.events.list({
        calendarId,
        timeMin: new Date().toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: "startTime",
    });
    return (res.data.items ?? []).map((e) => ({
        id: e.id,
        title: e.summary,
        start: e.start?.dateTime ?? e.start?.date,
        end: e.end?.dateTime ?? e.end?.date,
        attendees: e.attendees?.map((a) => a.email).filter(Boolean) ?? [],
        location: e.location,
    }));
}
//# sourceMappingURL=google-calendar.js.map