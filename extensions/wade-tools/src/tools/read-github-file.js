import { textResult } from "../types.js";
const GITHUB_OWNER = "colinreed88-maker";
export const definition = {
    name: "read_github_file",
    description: "Read a file from the Flow codebase on GitHub. Use to understand how pages work, how data is structured, what queries or filters a page uses, or how APIs are implemented. Available repos: flow-intranet, flow-ai-worker.",
    parameters: {
        type: "object",
        properties: {
            repo: {
                type: "string",
                description: "Repository name: 'flow-intranet' or 'flow-ai-worker'",
            },
            path: {
                type: "string",
                description: "File path within the repo (e.g., 'app/ask/page.tsx', 'src/tools.ts'). Use empty string or '/' to list root directory.",
            },
        },
        required: ["repo", "path"],
    },
};
export async function execute(_id, params) {
    const repo = params.repo;
    const path = params.path;
    const token = process.env.GITHUB_READ_TOKEN;
    if (!token)
        return textResult({ error: "GITHUB_READ_TOKEN not configured." });
    const allowedRepos = ["flow-intranet", "flow-ai-worker"];
    if (!allowedRepos.includes(repo)) {
        return textResult({ error: `Repo must be one of: ${allowedRepos.join(", ")}` });
    }
    const cleanPath = path.replace(/^\/+/, "");
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${repo}/contents/${cleanPath}`;
    try {
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "wade-openclaw-plugin",
            },
        });
        if (!res.ok) {
            const body = await res.text();
            return textResult({ error: `GitHub API ${res.status}: ${body.slice(0, 200)}` });
        }
        const data = await res.json();
        if (Array.isArray(data)) {
            const listing = data.map((item) => ({
                name: item.name,
                type: item.type,
                size: item.size,
                path: item.path,
            }));
            return textResult({ type: "directory", entries: listing });
        }
        if (data.encoding === "base64" && data.content) {
            const content = Buffer.from(data.content, "base64").toString("utf-8");
            if (content.length > 15000) {
                return textResult({
                    type: "file",
                    path: data.path,
                    size: data.size,
                    content: content.slice(0, 15000) + "\n\n[...truncated, file is " + data.size + " bytes]",
                });
            }
            return textResult({ type: "file", path: data.path, size: data.size, content });
        }
        return textResult({ type: "file", path: data.path, size: data.size, download_url: data.download_url });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult({ error: `GitHub read failed: ${msg}` });
    }
}
//# sourceMappingURL=read-github-file.js.map