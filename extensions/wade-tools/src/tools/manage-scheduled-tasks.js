import { getSupabase } from "../db.js";
import { textResult } from "../types.js";
export const definition = {
    name: "manage_scheduled_tasks",
    description: "Manage scheduled tasks (cron jobs). Actions: 'list' to see all tasks, 'create' to add a new one, 'update' to modify, 'delete' to remove, 'enable'/'disable' to toggle. IMPORTANT: For create/update/delete, show the details to the user first and only call after explicit approval.",
    parameters: {
        type: "object",
        properties: {
            action: {
                type: "string",
                description: "Action to perform: list, create, update, delete, enable, disable",
            },
            task_id: { type: "string", description: "Task ID (required for update, delete, enable, disable)" },
            name: { type: "string", description: "Task name (required for create)" },
            cron_expression: { type: "string", description: "Cron expression, e.g., '0 7 * * 1-5' for 7 AM weekdays (required for create)" },
            timezone: { type: "string", description: "Timezone (default: America/Los_Angeles)" },
            job_type: { type: "string", description: "Job type: daily_briefing, proactive_check, weekly_digest, etc. (required for create)" },
            job_instructions: { type: "string", description: "Instructions for the job (optional)" },
            job_context: { type: "object", description: "Additional context for the job (optional)" },
        },
        required: ["action"],
    },
};
export async function execute(_id, params) {
    const supabase = getSupabase();
    const action = params.action;
    switch (action) {
        case "list": {
            const { data, error } = await supabase
                .from("scheduled_tasks")
                .select("*")
                .order("created_at", { ascending: true });
            if (error)
                return textResult({ error: error.message });
            return textResult(data ?? []);
        }
        case "create": {
            const name = params.name;
            const cronExpr = params.cron_expression;
            if (!name || !cronExpr)
                return textResult({ error: "name and cron_expression are required for create." });
            const { data, error } = await supabase.from("scheduled_tasks").insert({
                name,
                cron_expression: cronExpr,
                timezone: params.timezone ?? "America/Los_Angeles",
                job_type: params.job_type ?? "freeform_question",
                job_instructions: params.job_instructions ?? null,
                job_context: params.job_context ?? {},
                enabled: true,
            }).select().single();
            if (error)
                return textResult({ error: error.message });
            return textResult({ created: true, task: data });
        }
        case "update": {
            const taskId = params.task_id;
            if (!taskId)
                return textResult({ error: "task_id is required for update." });
            const updates = {};
            if (params.name)
                updates.name = params.name;
            if (params.cron_expression)
                updates.cron_expression = params.cron_expression;
            if (params.timezone)
                updates.timezone = params.timezone;
            if (params.job_type)
                updates.job_type = params.job_type;
            if (params.job_instructions !== undefined)
                updates.job_instructions = params.job_instructions;
            if (params.job_context)
                updates.job_context = params.job_context;
            const { data, error } = await supabase
                .from("scheduled_tasks")
                .update(updates)
                .eq("id", taskId)
                .select()
                .single();
            if (error)
                return textResult({ error: error.message });
            return textResult({ updated: true, task: data });
        }
        case "delete": {
            const taskId = params.task_id;
            if (!taskId)
                return textResult({ error: "task_id is required for delete." });
            const { error } = await supabase.from("scheduled_tasks").delete().eq("id", taskId);
            if (error)
                return textResult({ error: error.message });
            return textResult({ deleted: true, task_id: taskId });
        }
        case "enable":
        case "disable": {
            const taskId = params.task_id;
            if (!taskId)
                return textResult({ error: "task_id is required." });
            const { data, error } = await supabase
                .from("scheduled_tasks")
                .update({ enabled: action === "enable" })
                .eq("id", taskId)
                .select()
                .single();
            if (error)
                return textResult({ error: error.message });
            return textResult({ [action + "d"]: true, task: data });
        }
        default:
            return textResult({ error: `Unknown action: ${action}. Use list, create, update, delete, enable, or disable.` });
    }
}
//# sourceMappingURL=manage-scheduled-tasks.js.map