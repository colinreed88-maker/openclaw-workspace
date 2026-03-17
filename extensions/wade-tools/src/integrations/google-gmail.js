import { google } from "googleapis";
/**
 * Uses the same OAuth2 credentials as Google Calendar (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN).
 * Requires gmail.readonly scope.
 */
function getAuth() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Gmail requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN");
    }
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
}
function getGmail() {
    return google.gmail({ version: "v1", auth: getAuth() });
}
export async function listEmails(params) {
    const gmail = getGmail();
    const userId = params.userId ?? "me";
    const res = await gmail.users.messages.list({
        userId,
        q: params.query ?? undefined,
        maxResults: Math.min(params.maxResults ?? 10, 50),
    });
    const messages = res.data.messages ?? [];
    const summaries = [];
    for (const msg of messages) {
        const detail = await gmail.users.messages.get({
            userId,
            id: msg.id,
            format: "metadata",
            metadataHeaders: ["Subject", "From", "Date"],
        });
        const headers = detail.data.payload?.headers ?? [];
        const getHeader = (name) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;
        summaries.push({
            id: detail.data.id,
            threadId: detail.data.threadId ?? "",
            labelIds: detail.data.labelIds ?? undefined,
            snippet: detail.data.snippet ?? undefined,
            subject: getHeader("Subject") ?? undefined,
            from: getHeader("From") ?? undefined,
            date: getHeader("Date") ?? undefined,
        });
    }
    return summaries;
}
export async function getEmail(messageId, userId = "me") {
    const gmail = getGmail();
    const res = await gmail.users.messages.get({
        userId,
        id: messageId,
        format: "full",
    });
    const headers = res.data.payload?.headers ?? [];
    const getHeader = (name) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;
    let bodyPlain;
    let bodyHtml;
    const payload = res.data.payload;
    if (payload?.body?.data) {
        bodyPlain = Buffer.from(payload.body.data, "base64url").toString("utf-8");
    }
    if (payload?.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === "text/plain" && part.body?.data) {
                bodyPlain = Buffer.from(part.body.data, "base64url").toString("utf-8");
                break;
            }
        }
        for (const part of payload.parts) {
            if (part.mimeType === "text/html" && part.body?.data) {
                bodyHtml = Buffer.from(part.body.data, "base64url").toString("utf-8");
                break;
            }
        }
    }
    return {
        id: res.data.id,
        threadId: res.data.threadId ?? "",
        subject: getHeader("Subject") ?? undefined,
        from: getHeader("From") ?? undefined,
        to: getHeader("To") ?? undefined,
        date: getHeader("Date") ?? undefined,
        snippet: res.data.snippet ?? undefined,
        bodyPlain,
        bodyHtml,
    };
}
//# sourceMappingURL=google-gmail.js.map