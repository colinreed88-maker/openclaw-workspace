import { sendEmail } from "../integrations/resend.js";
import { textResult } from "../types.js";
export const sendEmailDef = {
    name: "send_email",
    description: "Send an email via Resend. IMPORTANT: Show the full draft (to, subject, body, and any attachment filenames) to the user first. Only call this tool after the user explicitly approves (e.g. 'send it', 'approved', 'go ahead'). Domain-restricted to allowed email domains. Attachments: use url (e.g. from retrieve_knowledge_doc download_url) or content_base64 per item.",
    parameters: {
        type: "object",
        properties: {
            to: { type: "array", items: { type: "string" }, description: "Recipient email addresses" },
            subject: { type: "string", description: "Email subject line" },
            body: { type: "string", description: "Email body (plain text, newlines converted to <br>)" },
            cc: { type: "array", items: { type: "string" }, description: "CC recipients (optional)" },
            attachments: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        url: { type: "string", description: "Public or signed URL to the file (e.g. from retrieve_knowledge_doc)" },
                        filename: { type: "string", description: "Attachment filename (e.g. report.pdf)" },
                        content_base64: { type: "string", description: "Base64-encoded file content (alternative to url)" },
                    },
                    required: ["filename"],
                },
                description: "Optional. Attach files: provide url or content_base64 per item. Include attachment filenames in the draft shown to the user before sending.",
            },
        },
        required: ["to", "subject", "body"],
    },
};
function mapAttachments(raw) {
    const arr = Array.isArray(raw) ? raw : undefined;
    if (!arr?.length)
        return undefined;
    const out = [];
    for (const item of arr) {
        if (!item || typeof item !== "object" || !("filename" in item) || typeof item.filename !== "string")
            continue;
        const filename = item.filename;
        const url = item.url;
        const contentBase64 = item.content_base64;
        if (url)
            out.push({ filename, path: url });
        else if (contentBase64 && typeof contentBase64 === "string")
            out.push({ filename, content: contentBase64 });
    }
    return out.length ? out : undefined;
}
export async function sendEmailExecute(_id, params) {
    try {
        const attachments = mapAttachments(params.attachments);
        const result = await sendEmail({
            to: params.to,
            subject: params.subject,
            body: params.body,
            cc: params.cc,
            attachments,
        });
        return textResult({ sent: true, ...result });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Email failed: ${msg}` });
    }
}
//# sourceMappingURL=email.js.map