import { type ToolResult } from "../types.js";
export declare const definition: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            business_unit: {
                type: string;
                description: string;
            };
            department: {
                type: string;
                description: string;
            };
            department_id: {
                type: string;
                description: string;
            };
            entity_id: {
                type: string;
                description: string;
            };
            account_no: {
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
            source: {
                type: string;
                enum: string[];
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
