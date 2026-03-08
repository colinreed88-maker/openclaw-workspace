export function textResult(data) {
    return {
        content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data) }],
    };
}
//# sourceMappingURL=types.js.map