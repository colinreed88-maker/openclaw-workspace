import { type ToolResult } from "../types.js";
export declare const definition: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            action: {
                type: string;
                description: string;
            };
            task_id: {
                type: string;
                description: string;
            };
            name: {
                type: string;
                description: string;
            };
            cron_expression: {
                type: string;
                description: string;
            };
            timezone: {
                type: string;
                description: string;
            };
            job_type: {
                type: string;
                description: string;
            };
            job_instructions: {
                type: string;
                description: string;
            };
            job_context: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function execute(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
