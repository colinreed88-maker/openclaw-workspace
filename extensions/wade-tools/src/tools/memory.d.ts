import { type ToolResult } from "../types.js";
export declare const saveMemoryDef: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            content: {
                type: string;
                description: string;
            };
            type: {
                type: string;
                enum: string[];
                description: string;
            };
            correction_detail: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare const searchMemoriesDef: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare const forgetMemoryDef: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function saveMemory(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
export declare function searchMemories(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
export declare function forgetMemory(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
