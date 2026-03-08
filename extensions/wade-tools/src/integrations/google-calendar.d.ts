export interface CreateEventParams {
    title: string;
    start: string;
    end: string;
    attendees: string[];
    description?: string;
    calendarId?: string;
}
export declare function createCalendarEvent(params: CreateEventParams): Promise<{
    id: string | null | undefined;
    htmlLink: string | null | undefined;
    title: string;
    start: string;
    attendees: string[];
    timestamp: string;
}>;
export interface FreeBusyParams {
    attendees: string[];
    timeMin: string;
    timeMax: string;
}
export declare function queryFreeBusy(params: FreeBusyParams): Promise<Record<string, {
    start: string;
    end: string;
}[]>>;
export declare function listUpcomingEvents(maxResults?: number, calendarId?: string): Promise<{
    id: string | null | undefined;
    title: string | null | undefined;
    start: string | null | undefined;
    end: string | null | undefined;
    attendees: (string | null | undefined)[];
    location: string | null | undefined;
}[]>;
