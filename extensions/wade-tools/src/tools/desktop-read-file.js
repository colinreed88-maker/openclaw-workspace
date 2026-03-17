import { callBridge, isDesktopBridgeConfigured } from "../desktop-bridge.js";
import { textResult } from "../types.js";
export const definition = {
    name: "desktop_read_file",
    description: "Read a file from Colin's desktop machine. Use for files on C: drive (e.g. CR Sandbox), G: drive, or other allowed paths. Returns text by default; use encoding 'base64' for binary files.",
    parameters: {
        type: "object",
        properties: {
            path: { type: "string", description: "Full path to the file (e.g. G:\\Flow Root Drive\\... or C:\\Users\\colin\\...)" },
            encoding: { type: "string", description: "Encoding: 'utf8' (default), 'base64' for binary", enum: ["utf8", "base64"] },
        },
        required: ["path"],
    },
};
export async function execute(_id, params) {
    if (!isDesktopBridgeConfigured()) {
        return textResult("Desktop bridge is not configured. Colin needs to run the Wade Desktop Bridge app and set DESKTOP_BRIDGE_URL and DESKTOP_BRIDGE_SECRET on Railway.");
    }
    const path = params.path;
    const encoding = params.encoding || "utf8";
    const result = await callBridge("read_file", { path, encoding }, 60_000);
    if (!result.ok) {
        return textResult(`Desktop bridge error: ${result.error}`);
    }
    const data = result.data;
    if (data.encoding === "base64") {
        return textResult(`[Binary file, base64 length: ${data.content?.length ?? 0} chars. Use desktop_write_file or ask for a summary.]`);
    }
    return textResult(data.content ?? "");
}
//# sourceMappingURL=desktop-read-file.js.map