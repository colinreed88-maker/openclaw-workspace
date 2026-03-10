const DEFAULT_CHUNK_SIZE = 400;
const DEFAULT_OVERLAP = 50;
const MAX_CHUNK_CHARS = 6000;
export function chunkText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP) {
    const clean = text
        .replace(/\x00/g, "")
        .replace(/[\uFFFE\uFFFF]/g, "")
        .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, "");
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 0)
        return [];
    const chunks = [];
    let start = 0;
    while (start < words.length) {
        const end = Math.min(start + chunkSize, words.length);
        let chunk = words.slice(start, end).join(" ");
        if (chunk.length > MAX_CHUNK_CHARS)
            chunk = chunk.slice(0, MAX_CHUNK_CHARS);
        chunks.push(chunk);
        if (end >= words.length)
            break;
        start = end - overlap;
    }
    return chunks;
}
//# sourceMappingURL=chunking.js.map