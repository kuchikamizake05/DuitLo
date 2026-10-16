import { BillingError } from "./billing";

export async function readBillingJson(request: Request, maximumBytes: number): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > maximumBytes) throw new BillingError("Request too large", 413);
  if (!request.body) throw new BillingError("Missing request body", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new BillingError("Request too large", 413);
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new BillingError("Invalid JSON", 400); }
  } finally { reader.releaseLock(); }
}
