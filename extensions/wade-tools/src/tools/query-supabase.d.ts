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
            eq_filters: {
                type: string;
                description: string;
                additionalProperties: boolean;
            };
            gte_filters: {
                type: string;
                description: string;
                additionalProperties: {
                    type: string;
                };
            };
            lte_filters: {
                type: string;
                description: string;
                additionalProperties: {
                    type: string;
                };
            };
            in_filters: {
                type: string;
                description: string;
                additionalProperties: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
            };
            ilike_filters: {
                type: string;
                description: string;
                additionalProperties: {
                    type: string;
                };
            };
            or_filter: {
                type: string;
                description: string;
            };
            not_null: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
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
            rpc_name: {
                type: string;
                description: string;
            };
            rpc_params: {
                type: string;
                description: string;
                additionalProperties: boolean;
            };
        };
        required: never[];
    };
};
export declare function execute(_id: string, params: Record<string, unknown>): Promise<ToolResult>;
