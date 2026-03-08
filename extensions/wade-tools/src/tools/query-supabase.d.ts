import { type ToolResult } from "../types.js";
export declare const definition: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            table: {
                type: string;
                description: string;
            };
            select: {
                type: string;
                description: string;
            };
            filters: {
                type: string;
                description: string;
                additionalProperties: {
                    type: string;
                };
            };
            order_by: {
                type: string;
                description: string;
            };
            ascending: {
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
