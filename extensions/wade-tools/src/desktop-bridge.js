/**
 * HTTP client for the Wade Desktop Bridge (Electron app on Colin's machine).
 * Bridge is exposed via Cloudflare Tunnel; Wade calls it with Bearer token auth.
 */
const BRIDGE_URL = process.env.DESKTOP_BRIDGE_URL?.replace(/\/$/, "");
const BRIDGE_SECRET = process.env.DESKTOP_BRIDGE_SECRET;
export function isDesktopBridgeConfigured() {
    return Boolean(BRIDGE_URL && BRIDGE_SECRET);
}
export async function callBridge(endpoint, params, timeoutMs = 30_000) {
    if (!BRIDGE_URL || !BRIDGE_SECRET) {
        return { ok: false, error: "Desktop bridge not configured (DESKTOP_BRIDGE_URL / DESKTOP_BRIDGE_SECRET)" };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${BRIDGE_URL}/api/${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${BRIDGE_SECRET}`,
            },
            body: JSON.stringify(params),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { ok: false, error: body.error || `HTTP ${res.status}` };
        }
        return { ok: true, data: body };
    }
    catch (err) {
        clearTimeout(timeout);
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
    }
}
//# sourceMappingURL=desktop-bridge.js.map