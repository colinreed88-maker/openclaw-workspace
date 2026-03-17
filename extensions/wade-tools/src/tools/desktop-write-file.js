import { callBridge, isDesktopBridgeConfigured } from "../desktop-bridge.js";
import { textResult } from "../types.js";
export const definition = {
    name: "desktop_write_file",
    description: "Write content to a file on Colin's desktop. Path must be under allowed directories (e.g. CR Sandbox, G: drive).",
    parameters: {
        type: "object",
        properties: {
            path: { type: "string", description: "Full path to the file" },
            content: { type: "string", description: "Content to write" },
            encoding: { type: "string", description: "Encoding (default utf8)", enum: ["utf8", "base64"] },
        },
        required: ["path", "content"],
    },
};
export async function execute(_id, params) {
    if (!isDesktopBridgeConfigured()) {
        return textResult("Desktop bridge is not configured.");
    }
    const path = params.path;
    const content = params.content;
    const encoding = params.encoding || "utf8";
    const result = await callBridge("write_file", { path, content, encoding }, 30_000);
    if (!result.ok) {
        return textResult(`Desktop bridge error: ${result.error}`);
    }
    return textResult(`Wrote ${path} successfully.`);
}
//# sourceMappingURL=desktop-write-file.js.map