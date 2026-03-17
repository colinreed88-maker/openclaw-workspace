import { callBridge, isDesktopBridgeConfigured } from "../desktop-bridge.js";
import { textResult } from "../types.js";
export const definition = {
    name: "desktop_list_files",
    description: "List files and folders in a directory on Colin's desktop. Use for browsing C: drive, G: drive, or CR Sandbox.",
    parameters: {
        type: "object",
        properties: {
            directory: { type: "string", description: "Full path to the directory" },
            pattern: { type: "string", description: "Optional regex pattern to filter names" },
            recursive: { type: "boolean", description: "List recursively (default false)" },
        },
        required: ["directory"],
    },
};
export async function execute(_id, params) {
    if (!isDesktopBridgeConfigured()) {
        return textResult("Desktop bridge is not configured.");
    }
    const directory = params.directory;
    const pattern = params.pattern;
    const recursive = Boolean(params.recursive);
    const result = await callBridge("list_files", { directory, pattern, recursive }, 30_000);
    if (!result.ok) {
        return textResult(`Desktop bridge error: ${result.error}`);
    }
    const entries = result.data.entries ?? [];
    const lines = entries.map((e) => `${e.isDirectory ? "[DIR] " : ""}${e.name}${e.size != null ? ` (${e.size} bytes)` : ""} ${e.mtime ?? ""}`);
    return textResult(lines.length ? lines.join("\n") : "(empty directory)");
}
//# sourceMappingURL=desktop-list-files.js.map