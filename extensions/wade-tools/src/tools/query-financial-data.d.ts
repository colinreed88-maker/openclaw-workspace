import { type ToolResult } from "../types.js";
export declare const definition: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            question: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function execute(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
