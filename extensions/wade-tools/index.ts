import type { OpenClawApi } from "./src/types.js";

// Financial query tools
import * as queryRampSpend from "./src/tools/query-ramp-spend.js";
import * as querySageGl from "./src/tools/query-sage-gl.js";
import * as queryToastData from "./src/tools/query-toast-data.js";

// Utility tools
import * as querySupabase from "./src/tools/query-supabase.js";
import * as queryFinancialData from "./src/tools/query-financial-data.js";
import * as retrieveKnowledgeDoc from "./src/tools/retrieve-knowledge-doc.js";
import * as retrieveRampInvoice from "./src/tools/retrieve-ramp-invoice.js";

// Memory tools
import {
  saveMemoryDef, saveMemory,
  searchMemoriesDef, searchMemories,
  forgetMemoryDef, forgetMemory,
} from "./src/tools/memory.js";

// External tools
import * as searchWeb from "./src/tools/search-web.js";
import * as manageScheduledTasks from "./src/tools/manage-scheduled-tasks.js";

// Side-effect tools (email, calendar)
import { sendEmailDef, sendEmailExecute } from "./src/tools/email.js";
import {
  createCalendarEventDef, createCalendarEventExecute,
  getCalendarAvailabilityDef, getCalendarAvailabilityExecute,
  listUpcomingEventsDef, listUpcomingEventsExecute,
} from "./src/tools/calendar.js";

export default function (api: OpenClawApi) {

  // ── Data tools ──

  api.registerTool({
    ...querySupabase.definition,
    execute: querySupabase.execute,
  });

  api.registerTool({
    ...queryRampSpend.definition,
    execute: queryRampSpend.execute,
  });

  api.registerTool({
    ...querySageGl.definition,
    execute: querySageGl.execute,
  });

  api.registerTool({
    ...queryToastData.definition,
    execute: queryToastData.execute,
  });

  // ── Utility tools ──

  api.registerTool({
    ...queryFinancialData.definition,
    execute: queryFinancialData.execute,
  });

  api.registerTool({
    ...retrieveKnowledgeDoc.definition,
    execute: retrieveKnowledgeDoc.execute,
  });

  api.registerTool({
    ...retrieveRampInvoice.definition,
    execute: retrieveRampInvoice.execute,
  });

  // ── Memory tools ──

  api.registerTool({
    ...saveMemoryDef,
    execute: saveMemory,
  });

  api.registerTool({
    ...searchMemoriesDef,
    execute: searchMemories,
  });

  api.registerTool({
    ...forgetMemoryDef,
    execute: forgetMemory,
  });

  // ── External tools ──

  api.registerTool({
    ...searchWeb.definition,
    execute: searchWeb.execute,
  });

  // ── Side-effect tools ──

  api.registerTool({
    ...sendEmailDef,
    execute: sendEmailExecute,
  });

  api.registerTool({
    ...createCalendarEventDef,
    execute: createCalendarEventExecute,
  });

  api.registerTool({
    ...getCalendarAvailabilityDef,
    execute: getCalendarAvailabilityExecute,
  });

  api.registerTool({
    ...listUpcomingEventsDef,
    execute: listUpcomingEventsExecute,
  });

  api.registerTool({
    ...manageScheduledTasks.definition,
    execute: manageScheduledTasks.execute,
  });
}
