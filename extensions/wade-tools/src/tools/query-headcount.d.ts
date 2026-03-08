import { type ToolResult } from "../types.js";
export declare const definition: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            source: {
                type: string;
                enum: string[];
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
            employee_search: {
                type: string;
                description: string;
            };
            status: {
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
            group_by: {
                type: string;
                enum: string[];
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
        };
        required: never[];
    };
};
export declare function execute(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
