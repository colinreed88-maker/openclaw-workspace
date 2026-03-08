export interface ToolResult {
    content: Array<{
        type: "text";
        text: string;
    }>;
}
export declare function textResult(data: unknown): ToolResult;
export interface OpenClawApi {
    registerTool(def: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
        execute: (id: string, params: Record<string, unknown>) => Promise<ToolResult>;
    }, opts?: {
        optional?: boolean;
    }): void;
}
