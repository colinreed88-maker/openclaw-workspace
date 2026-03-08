import { type ToolResult } from "../types.js";
export declare const sendEmailDef: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            to: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            subject: {
                type: string;
                description: string;
            };
            body: {
                type: string;
                description: string;
            };
            cc: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
        required: string[];
    };
};
export declare function sendEmailExecute(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
export declare const approveActionDef: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            action_id: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function approveActionExecute(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
export declare const rejectActionDef: {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            action_id: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function rejectActionExecute(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
