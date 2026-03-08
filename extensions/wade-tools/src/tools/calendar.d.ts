import { type ToolResult } from "../types.js";
export declare const createCalendarEventDef: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            title: {
                type: string;
                description: string;
            };
            start: {
                type: string;
                description: string;
            };
            end: {
                type: string;
                description: string;
            };
            attendees: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function createCalendarEventExecute(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
export declare const getCalendarAvailabilityDef: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            attendees: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            time_min: {
                type: string;
                description: string;
            };
            time_max: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function getCalendarAvailabilityExecute(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
export declare const listUpcomingEventsDef: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            max_results: {
                type: string;
                description: string;
            };
        };
        required: never[];
    };
};
export declare function listUpcomingEventsExecute(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
