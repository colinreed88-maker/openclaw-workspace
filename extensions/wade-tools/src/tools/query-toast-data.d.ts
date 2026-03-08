import { type ToolResult } from "../types.js";
export declare const definition: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            metric: {
                type: string;
                enum: string[];
                description: string;
            };
            location: {
                type: string;
                description: string;
            };
            date_from: {
                type: string;
                description: string;
            };
            date_to: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function execute(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
