import { getSupabase } from "../db.js";
import { textResult } from "../types.js";
const DEFAULT_DAILY_LIMIT = 10;
async function countTodayActions(actionType) {
    const supabase = getSupabase();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabase
        .from("assistant_actions")
        .select("id", { count: "exact", head: true })
        .eq("action_type", actionType)
        .in("status", ["proposed", "approved", "executing", "executed"])
        .gte("created_at", todayStart.toISOString());
    return count ?? 0;
}
async function getDailyLimit(actionType) {
    const supabase = getSupabase();
    const today = new Date().toISOString().slice(0, 10);
    const { data: overrides } = await supabase
        .from("agent_memories")
        .select("content")
        .eq("type", "rule")
        .ilike("content", `%${actionType} limit override%${today}%`)
        .order("created_at", { ascending: false })
        .limit(1);
    if (overrides?.length) {
        const match = overrides[0].content.match(/override:\s*(\d+)/i);
        if (match)
            return parseInt(match[1], 10);
    }
    return DEFAULT_DAILY_LIMIT;
}
async function queueForApproval(toolName, input, requestId) {
    const supabase = getSupabase();
    const countToday = await countTodayActions(toolName);
    const limit = await getDailyLimit(toolName);
    if (countToday >= limit) {
        return textResult({
            error: `Daily ${toolName.replace(/_/g, " ")} limit reached (${countToday}/${limit}). Ask Colin if he'd like to increase the limit for today.`,
        });
    }
    const { data: action, error } = await supabase
        .from("assistant_actions")
        .insert({
        request_id: requestId,
        action_type: toolName,
        payload: input,
        status: "proposed",
    })
        .select("id")
        .single();
    if (error)
        return textResult({ error: `Failed to queue ${toolName}: ${error.message}` });
    const label = toolName === "send_email" ? "email" : "calendar event";
    return textResult({
        status: "proposed",
        action_id: action?.id,
        message: `I've drafted the ${label}. Would you like me to send it?`,
    });
}
export const sendEmailDef = {
    name: "send_email",
    description: "Send an email via Resend. Use for notifications, reports, and communications. Domain-restricted to allowed domains.",
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
export async function sendEmailExecute(_id, params) {
    return queueForApproval("send_email", params, _id);
}
export const approveActionDef = {
    name: "approve_action",
    description: "Approve a pending action (email or calendar event) after the user explicitly confirms. Only call this when the user has clearly approved the proposed action in the current conversation.",
    parameters: {
        type: "object",
        properties: {
            action_id: {
                type: "string",
                description: "The action_id returned when the action was queued",
            },
        },
        required: ["action_id"],
    },
};
export async function approveActionExecute(_id, params) {
    return handleActionDecision(params.action_id, "approved", _id);
}
export const rejectActionDef = {
    name: "reject_action",
    description: "Reject/cancel a pending action (email or calendar event) when the user declines.",
    parameters: {
        type: "object",
        properties: {
            action_id: {
                type: "string",
                description: "The action_id returned when the action was queued",
            },
        },
        required: ["action_id"],
    },
};
export async function rejectActionExecute(_id, params) {
    return handleActionDecision(params.action_id, "rejected", _id);
}
async function handleActionDecision(actionId, decision, requestId) {
    const supabase = getSupabase();
    const { data: action, error } = await supabase
        .from("assistant_actions")
        .select("id, action_type, status")
        .eq("id", actionId)
        .single();
    if (error || !action) {
        return textResult({ error: `Action ${actionId} not found.` });
    }
    if (action.status !== "proposed") {
        return textResult({ error: `Action is already ${action.status}, cannot ${decision}.` });
    }
    await supabase
        .from("assistant_actions")
        .update({ status: decision })
        .eq("id", actionId);
    await supabase.from("assistant_audit_log").insert({
        request_id: requestId,
        action_id: actionId,
        event_type: decision === "approved" ? "ACTION_APPROVED" : "ACTION_REJECTED",
        details: { source: "openclaw_plugin" },
    });
    const label = action.action_type === "send_email" ? "email" : "calendar event";
    if (decision === "approved") {
        return textResult({ status: "approved", message: `${label} approved and will be sent shortly.` });
    }
    return textResult({ status: "rejected", message: `${label} cancelled.` });
}
//# sourceMappingURL=email.js.map