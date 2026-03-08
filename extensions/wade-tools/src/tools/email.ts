import { sendEmail } from "../integrations/resend.js";
import { textResult, type ToolResult } from "../types.js";

export const sendEmailDef = {
  name: "send_email",
  description:
    "Send an email via Resend. IMPORTANT: Show the full draft (to, subject, body) to the user first. Only call this tool after the user explicitly approves (e.g. 'send it', 'approved', 'go ahead'). Domain-restricted to allowed email domains.",
  parameters: {
    type: "object",
    properties: {
      to: { type: "array", items: { type: "string" }, description: "Recipient email addresses" },
      subject: { type: "string", description: "Email subject line" },
      body: { type: "string", description: "Email body (plain text, newlines converted to <br>)" },
      cc: { type: "array", items: { type: "string" }, description: "CC recipients (optional)" },
    },
    required: ["to", "subject", "body"],
  },
};

export async function sendEmailExecute(_id: string, params: Record<string, unknown>): Promise<ToolResult> {
  try {
    const result = await sendEmail({
      to: params.to as string[],
      subject: params.subject as string,
      body: params.body as string,
      cc: params.cc as string[] | undefined,
    });
    return textResult({ sent: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return textResult({ error: `Email failed: ${msg}` });
  }
}
