import { type ToolResult } from "../types.js";
export declare const definition: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            table: {
                type: string;
                enum: string[];
                description: string;
            };
            scenario_id: {
                type: string;
                description: string;
            };
            business_unit: {
                type: string;
                description: string;
            };
            department: {
                type: string;
                description: string;
            };
            line_item: {
                type: string;
                description: string;
            };
            month_from: {
                type: string;
                description: string;
            };
            month_to: {
                type: string;
                description: string;
            };
            section: {
                type: string;
                enum: string[];
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
