import { WebClient } from "@slack/web-api";
import { textResult } from "../types.js";
export const definition = {
    name: "read_slack",
    description: "Read messages from Colin's Slack workspace. Can list channels Colin is in, read recent messages from a channel (by name or ID), or search across all messages. Uses Colin's user token so it sees everything he sees, including DMs and private channels.",
    parameters: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["list_channels", "read_messages", "search_messages"],
                description: "list_channels = show channels Colin is in; read_messages = get recent messages from a channel; search_messages = full-text search across workspace",
            },
            channel: {
                type: "string",
                description: "Channel name (without #) or Slack channel ID. Required for read_messages.",
            },
            query: {
                type: "string",
                description: "Search query string. Required for search_messages.",
            },
            limit: {
                type: "number",
                description: "Max channels or messages to return (default 200 for list_channels, 20 for messages, max 500).",
            },
        },
        required: ["action"],
    },
};
let _client = null;
function getClient() {
    if (_client)
        return _client;
    const token = process.env.SLACK_USER_TOKEN;
    if (!token)
        throw new Error("SLACK_USER_TOKEN not configured.");
    _client = new WebClient(token);
    return _client;
}
const userCache = new Map();
async function resolveUserName(client, userId) {
    if (userCache.has(userId))
        return userCache.get(userId);
    try {
        const info = await client.users.info({ user: userId });
        const u = info.user;
        const name = u?.real_name || u?.display_name || u?.name || userId;
        userCache.set(userId, name);
        return name;
    }
    catch {
        return userId;
    }
}
async function resolveChannelId(client, nameOrId) {
    if (nameOrId.startsWith("C") || nameOrId.startsWith("D") || nameOrId.startsWith("G")) {
        if (/^[A-Z0-9]{9,12}$/.test(nameOrId))
            return nameOrId;
    }
    const cleanName = nameOrId.replace(/^#/, "");
    let cursor;
    do {
        const result = await client.users.conversations({
            types: "public_channel,private_channel,mpim,im",
            limit: 200,
            exclude_archived: true,
            ...(cursor ? { cursor } : {}),
        });
        const ch = result.channels?.find((c) => c.name === cleanName);
        if (ch?.id)
            return ch.id;
        cursor = result.response_metadata?.next_cursor || undefined;
    } while (cursor);
    throw new Error(`Channel "${nameOrId}" not found. Use list_channels to see available channels.`);
}
async function listChannels(client, limit) {
    const allChannels = [];
    let cursor;
    const pageSize = 200;
    do {
        const result = await client.users.conversations({
            types: "public_channel,private_channel,mpim,im",
            limit: pageSize,
            exclude_archived: true,
            ...(cursor ? { cursor } : {}),
        });
        const page = result.channels || [];
        allChannels.push(...page);
        cursor = result.response_metadata?.next_cursor || undefined;
        if (!cursor)
            break;
    } while (allChannels.length < limit);
    const channels = allChannels.slice(0, limit);
    const formatted = await Promise.all(channels.map(async (ch) => {
        let type = "channel";
        if (ch.is_im)
            type = "dm";
        else if (ch.is_mpim)
            type = "group-dm";
        else if (ch.is_private)
            type = "private";
        let label = ch.name || ch.id || "unknown";
        if (ch.is_im && ch.user) {
            label = `DM with ${await resolveUserName(client, ch.user)}`;
        }
        return {
            id: ch.id,
            name: label,
            type,
            members: ch.num_members,
            purpose: ch.purpose?.value || undefined,
        };
    }));
    return textResult({
        channel_count: formatted.length,
        total_available: allChannels.length,
        channels: formatted,
    });
}
async function readMessages(client, channelNameOrId, limit) {
    const channelId = await resolveChannelId(client, channelNameOrId);
    const result = await client.conversations.history({
        channel: channelId,
        limit: Math.min(limit, 100),
    });
    const messages = result.messages || [];
    const formatted = await Promise.all(messages
        .filter((m) => m.type === "message")
        .map(async (m) => {
        const author = m.user ? await resolveUserName(client, m.user) : m.subtype || "system";
        const ts = m.ts ? new Date(parseFloat(m.ts) * 1000).toISOString() : undefined;
        return { author, text: m.text, timestamp: ts };
    }));
    return textResult({
        channel: channelNameOrId,
        message_count: formatted.length,
        messages: formatted.reverse(),
    });
}
async function searchMessages(client, query, limit) {
    const result = await client.search.messages({
        query,
        count: Math.min(limit, 100),
        sort: "timestamp",
        sort_dir: "desc",
    });
    const matches = result.messages?.matches || [];
    const formatted = matches.map((m) => ({
        author: m.username,
        channel: m.channel?.name,
        text: m.text,
        timestamp: m.ts ? new Date(parseFloat(m.ts) * 1000).toISOString() : undefined,
        permalink: m.permalink,
    }));
    return textResult({
        query,
        result_count: formatted.length,
        total: result.messages?.total,
        results: formatted,
    });
}
export async function execute(_id, params) {
    const action = params.action;
    const defaultLimit = action === "list_channels" ? 500 : 20;
    const maxLimit = action === "list_channels" ? 500 : 100;
    const limit = Math.min(params.limit ?? defaultLimit, maxLimit);
    let client;
    try {
        client = getClient();
    }
    catch (err) {
        return textResult({ error: err instanceof Error ? err.message : String(err) });
    }
    try {
        switch (action) {
            case "list_channels":
                return await listChannels(client, limit);
            case "read_messages": {
                const channel = params.channel;
                if (!channel)
                    return textResult({ error: "channel is required for read_messages" });
                return await readMessages(client, channel, limit);
            }
            case "search_messages": {
                const query = params.query;
                if (!query)
                    return textResult({ error: "query is required for search_messages" });
                return await searchMessages(client, query, limit);
            }
            default:
                return textResult({ error: `Unknown action: ${action}. Use list_channels, read_messages, or search_messages.` });
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `Slack operation failed: ${msg}` });
    }
}
//# sourceMappingURL=read-slack.js.map