import { callBridge, isDesktopBridgeConfigured } from "../desktop-bridge.js";
import { textResult } from "../types.js";
export const definition = {
    name: "desktop_shell",
    description: "Run a PowerShell command on Colin's desktop. Use for listing dirs, running scripts, opening apps, or any local automation. Output is truncated to 1MB; timeout default 60s.",
    parameters: {
        type: "object",
        properties: {
            command: { type: "string", description: "PowerShell command to run" },
            timeout_ms: { type: "number", description: "Timeout in milliseconds (default 60000)" },
            cwd: { type: "string", description: "Working directory (optional)" },
        },
        required: ["command"],
    },
};
export async function execute(_id, params) {
    if (!isDesktopBridgeConfigured()) {
        return textResult("Desktop bridge is not configured.");
    }
    const command = params.command;
    const timeout_ms = typeof params.timeout_ms === "number" ? params.timeout_ms : 60_000;
    const cwd = params.cwd;
    const result = await callBridge("shell", { command, timeout_ms, cwd }, Math.min(timeout_ms + 5000, 330_000));
    if (!result.ok) {
        return textResult(`Desktop bridge error: ${result.error}`);
    }
    const d = result.data;
    let out = d.stdout?.trim() || "";
    if (d.stderr?.trim())
        out += "\nstderr:\n" + d.stderr.trim();
    if (d.exitCode !== 0)
        out += `\n(exit code ${d.exitCode})`;
    return textResult(out || "(no output)");
}
//# sourceMappingURL=desktop-shell.js.map