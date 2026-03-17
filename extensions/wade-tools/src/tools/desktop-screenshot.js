import { callBridge, isDesktopBridgeConfigured } from "../desktop-bridge.js";
import { textResult } from "../types.js";
export const definition = {
    name: "desktop_screenshot",
    description: "Capture a screenshot of Colin's desktop. Returns a base64 PNG. Use when you need to see what is on screen.",
    parameters: {
        type: "object",
        properties: {
            display: { type: "number", description: "Display index (optional; omit for primary)" },
        },
    },
};
export async function execute(_id, params) {
    if (!isDesktopBridgeConfigured()) {
        return textResult("Desktop bridge is not configured.");
    }
    const display = params.display;
    const result = await callBridge("screenshot", display != null ? { display } : {}, 15_000);
    if (!result.ok) {
        return textResult(`Desktop bridge error: ${result.error}`);
    }
    const d = result.data;
    const len = d.image?.length ?? 0;
    return textResult(`Screenshot captured (PNG base64, ${len} chars). Image data not shown in chat; use for internal reference or ask Colin to check the file.`);
}
//# sourceMappingURL=desktop-screenshot.js.map