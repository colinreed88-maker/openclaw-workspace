// Financial query tools
import * as queryRampSpend from "./src/tools/query-ramp-spend.js";
import * as querySageGl from "./src/tools/query-sage-gl.js";
import * as queryToastData from "./src/tools/query-toast-data.js";
import * as querySnowflake from "./src/tools/query-snowflake.js";
// Utility tools
import * as querySupabase from "./src/tools/query-supabase.js";
import * as queryFinancialData from "./src/tools/query-financial-data.js";
import * as retrieveKnowledgeDoc from "./src/tools/retrieve-knowledge-doc.js";
import * as retrieveRampInvoice from "./src/tools/retrieve-ramp-invoice.js";
// Knowledge & memory tools
import * as searchKnowledge from "./src/tools/search-knowledge.js";
import { saveMemoryDef, saveMemory, searchMemoriesDef, searchMemories, forgetMemoryDef, forgetMemory, } from "./src/tools/memory.js";
// Ingestion tools
import * as ingestSlack from "./src/tools/ingest-slack.js";
import * as ingestCalendar from "./src/tools/ingest-calendar.js";
import * as ingestRss from "./src/tools/ingest-rss.js";
import * as ingestGranola from "./src/tools/ingest-granola.js";
import * as queryIngestionLog from "./src/tools/query-ingestion-log.js";
// External tools
import * as searchWeb from "./src/tools/search-web.js";
import * as readGithubFile from "./src/tools/read-github-file.js";
import * as readSlack from "./src/tools/read-slack.js";
// Side-effect tools (email, calendar)
import { sendEmailDef, sendEmailExecute } from "./src/tools/email.js";
import { createCalendarEventDef, createCalendarEventExecute, getCalendarAvailabilityDef, getCalendarAvailabilityExecute, listUpcomingEventsDef, listUpcomingEventsExecute, } from "./src/tools/calendar.js";
import { listEmailsDef, listEmailsExecute, getEmailDef, getEmailExecute, } from "./src/tools/gmail.js";
// Desktop bridge tools (Colin's machine via Cloudflare Tunnel)
import * as desktopReadFile from "./src/tools/desktop-read-file.js";
import * as desktopWriteFile from "./src/tools/desktop-write-file.js";
import * as desktopListFiles from "./src/tools/desktop-list-files.js";
import * as desktopShell from "./src/tools/desktop-shell.js";
import * as desktopScreenshot from "./src/tools/desktop-screenshot.js";
import * as desktopClipboard from "./src/tools/desktop-clipboard.js";
export default function (api) {
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
    api.registerTool({
        ...querySnowflake.definition,
        execute: querySnowflake.execute,
    });
    // ── Knowledge & memory tools ──
    api.registerTool({
        ...searchKnowledge.definition,
        execute: searchKnowledge.execute,
    });
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
    // ── Ingestion tools ──
    api.registerTool({
        ...ingestSlack.definition,
        execute: ingestSlack.execute,
    });
    api.registerTool({
        ...ingestCalendar.definition,
        execute: ingestCalendar.execute,
    });
    api.registerTool({
        ...ingestRss.definition,
        execute: ingestRss.execute,
    });
    api.registerTool({
        ...ingestGranola.definition,
        execute: ingestGranola.execute,
    });
    api.registerTool({
        ...queryIngestionLog.definition,
        execute: queryIngestionLog.execute,
    });
    // ── External tools ──
    api.registerTool({
        ...searchWeb.definition,
        execute: searchWeb.execute,
    });
    api.registerTool({
        ...readGithubFile.definition,
        execute: readGithubFile.execute,
    });
    api.registerTool({
        ...readSlack.definition,
        execute: readSlack.execute,
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
        ...listEmailsDef,
        execute: listEmailsExecute,
    });
    api.registerTool({
        ...getEmailDef,
        execute: getEmailExecute,
    });
    // ── Desktop bridge tools ──
    api.registerTool({
        ...desktopReadFile.definition,
        execute: desktopReadFile.execute,
    });
    api.registerTool({
        ...desktopWriteFile.definition,
        execute: desktopWriteFile.execute,
    });
    api.registerTool({
        ...desktopListFiles.definition,
        execute: desktopListFiles.execute,
    });
    api.registerTool({
        ...desktopShell.definition,
        execute: desktopShell.execute,
    });
    api.registerTool({
        ...desktopScreenshot.definition,
        execute: desktopScreenshot.execute,
    });
    api.registerTool({
        ...desktopClipboard.definition,
        execute: desktopClipboard.execute,
    });
}
//# sourceMappingURL=index.js.map