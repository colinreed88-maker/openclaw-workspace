import { callBridge, isDesktopBridgeConfigured } from "../desktop-bridge.js";
import { textResult } from "../types.js";
export const definition = {
    name: "desktop_clipboard",
    description: "Read or write Colin's desktop clipboard. Use to get text from clipboard or paste text into it.",
    parameters: {
        type: "object",
        properties: {
            operation: { type: "string", description: "read or write", enum: ["read", "write"] },
            text: { type: "string", description: "For write: text to put on clipboard" },
        },
        required: ["operation"],
    },
};
export async function execute(_id, params) {
    if (!isDesktopBridgeConfigured()) {
        return textResult("Desktop bridge is not configured.");
    }
    const operation = params.operation;
    const text = params.text;
    if (operation !== "read" && operation !== "write") {
        return textResult("operation must be 'read' or 'write'.");
    }
    if (operation === "write" && text === undefined) {
        return textResult("text is required for write.");
    }
    const result = await callBridge("clipboard", operation === "write" ? { operation, text } : { operation }, 5_000);
    if (!result.ok) {
        return textResult(`Desktop bridge error: ${result.error}`);
    }
    const d = result.data;
    if (operation === "read") {
        return textResult(d.content ?? "(clipboard empty)");
    }
    return textResult("Clipboard updated.");
}
//# sourceMappingURL=desktop-clipboard.js.map