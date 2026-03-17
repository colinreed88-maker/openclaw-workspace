import { listEmails, getEmail } from "../integrations/google-gmail.js";
import { textResult } from "../types.js";
export const listEmailsDef = {
    name: "list_emails",
    description: "List recent emails from the user's Gmail inbox. Use a Gmail search query (e.g. 'from:someone@flow.life', 'is:unread', 'newer_than:7d') to filter. Returns subject, from, date, snippet, and message id for each.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Gmail search query (e.g. 'from:colin@flow.life', 'is:unread', 'newer_than:3d'). Omit to list latest inbox.",
            },
            max_results: {
                type: "number",
                description: "Max number of messages to return (default 10, max 50)",
            },
        },
        required: [],
    },
};
export async function listEmailsExecute(_id, params) {
    try {
        const results = await listEmails({
            query: params.query,
            maxResults: params.max_results ?? 10,
        });
        return textResult({ emails: results });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Gmail list failed: ${msg}` });
    }
}
export const getEmailDef = {
    name: "get_email",
    description: "Get the full content of a single Gmail message by id. Use list_emails first to get message ids. Returns subject, from, to, date, and body (plain text).",
    parameters: {
        type: "object",
        properties: {
            message_id: { type: "string", description: "Gmail message id (from list_emails)" },
        },
        required: ["message_id"],
    },
};
export async function getEmailExecute(_id, params) {
    try {
        const email = await getEmail(params.message_id);
        return textResult({
            id: email.id,
            threadId: email.threadId,
            subject: email.subject,
            from: email.from,
            to: email.to,
            date: email.date,
            snippet: email.snippet,
            bodyPlain: email.bodyPlain,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Gmail get failed: ${msg}` });
    }
}
//# sourceMappingURL=gmail.js.map