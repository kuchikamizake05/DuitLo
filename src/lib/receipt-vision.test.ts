import { describe, expect, it } from "vitest";
import {
  buildQwenReceiptRequest,
  createReceiptRateLimiter,
  mapQwenFailure,
  parseQwenReceiptResponse,
  receiptExtractionSchema,
  validateReceiptParseSecurity,
} from "./receipt-vision";

const sampleValidPayload = {
  date: "2026-08-20",
  merchant: "Indomaret Point",
  amount: 45000,
  categoryHint: "Belanja",
  type: "expense",
  proofKind: "receipt",
  note: "Kopi dan roti",
  rawText: "INDOMARET POINT TOTAL 45.000",
  confidence: 0.95,
};

describe("receiptExtractionSchema", () => {
  it("rejects impossible calendar dates from extracted receipts", () => {
    for (const date of ["2026-02-29", "2026-02-31", "2026-04-31"]) {
      expect(receiptExtractionSchema.safeParse({ ...sampleValidPayload, date }).success).toBe(false);
    }
    for (const date of ["2024-02-29", "2026-02-28", "2026-04-30"]) {
      expect(receiptExtractionSchema.safeParse({ ...sampleValidPayload, date }).success).toBe(true);
    }
  });
  it("accepts valid extraction data", () => {
    const result = receiptExtractionSchema.safeParse(sampleValidPayload);
    expect(result.success).toBe(true);
  });

  it("accepts transfer proof with income direction", () => {
    expect(receiptExtractionSchema.safeParse({
      ...sampleValidPayload,
      merchant: "Transfer masuk",
      type: "income",
      proofKind: "transfer",
    }).success).toBe(true);
  });

  it("accepts nullable fields as long as at least one core field exists", () => {
    const partial = {
      date: null,
      merchant: "Warung Kopi",
      amount: null,
      categoryHint: null,
      type: null,
      proofKind: null,
      note: null,
      rawText: null,
      confidence: null,
    };
    expect(receiptExtractionSchema.safeParse(partial).success).toBe(true);
  });

  it("rejects payload when all useful fields are null", () => {
    const empty = {
      date: null,
      merchant: null,
      amount: null,
      categoryHint: null,
      type: null,
      proofKind: null,
      note: null,
      rawText: "teks tidak jelas",
      confidence: 0.1,
    };
    expect(receiptExtractionSchema.safeParse(empty).success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const invalidDate = { ...sampleValidPayload, date: "20-08-2026" };
    expect(receiptExtractionSchema.safeParse(invalidDate).success).toBe(false);
  });

  it("rejects negative or zero amount", () => {
    expect(receiptExtractionSchema.safeParse({ ...sampleValidPayload, amount: -5000 }).success).toBe(false);
    expect(receiptExtractionSchema.safeParse({ ...sampleValidPayload, amount: 0 }).success).toBe(false);
  });

  it("rejects out of bound confidence", () => {
    expect(receiptExtractionSchema.safeParse({ ...sampleValidPayload, confidence: 1.5 }).success).toBe(false);
    expect(receiptExtractionSchema.safeParse({ ...sampleValidPayload, confidence: -0.1 }).success).toBe(false);
  });
});

describe("buildQwenReceiptRequest", () => {
  it("constructs an image URL message and JSON response payload", () => {
    const request = buildQwenReceiptRequest({
      mimeType: "image/jpeg",
      base64Data: "abc123xyz",
    });

    expect(request).toMatchObject({
      messages: [{}, { content: [{}, { type: "image_url", image_url: { url: "data:image/jpeg;base64,abc123xyz" } }] }],
      response_format: { type: "json_object" },
    });
  });
});

describe("parseQwenReceiptResponse", () => {
  it("parses valid Qwen chat completion envelope", () => {
    const providerResponse = {
      choices: [{ message: { content: JSON.stringify(sampleValidPayload) } }],
    };

    const parsed = parseQwenReceiptResponse(providerResponse);
    expect(parsed).toEqual(sampleValidPayload);
  });

  it("throws error for missing or malformed completions", () => {
    expect(() => parseQwenReceiptResponse({})).toThrow();
    expect(() => parseQwenReceiptResponse({ choices: [] })).toThrow();
    expect(() => parseQwenReceiptResponse({
      choices: [{ message: { content: "not-json" } }],
    })).toThrow();
  });

  it("accepts omitted nullable fields and a JSON code fence without inventing values", () => {
    const content = '```json\n{"merchant":"Kopi Uji","amount":25000}\n```';
    expect(parseQwenReceiptResponse({choices:[{message:{content}}]})).toEqual({
      merchant:"Kopi Uji",amount:25000,date:null,categoryHint:null,type:null,proofKind:null,note:null,rawText:null,confidence:null,
    });
  });

  it("rejects truncated output even when its content happens to be valid JSON", () => {
    expect(()=>parseQwenReceiptResponse({choices:[{finish_reason:"length",message:{content:JSON.stringify(sampleValidPayload)}}]})).toThrow();
  });

  it("keeps invalid amounts and unknown fields invalid when normalizing partial output", () => {
    for (const payload of [{amount:"25000"},{amount:-25000},{amount:25000,unexpected:"field"},{}]) {
      expect(()=>parseQwenReceiptResponse({choices:[{message:{content:JSON.stringify(payload)}}]})).toThrow();
    }
  });
});

describe("createReceiptRateLimiter", () => {
  it("enforces rate limits within window", () => {
    const limiter = createReceiptRateLimiter({ maxRequests: 2, windowMs: 1000 });
    expect(limiter.consume("user-1", 1000).allowed).toBe(true);
    expect(limiter.consume("user-1", 1200).allowed).toBe(true);
    expect(limiter.consume("user-1", 1300).allowed).toBe(false);
    expect(limiter.consume("user-1", 2100).allowed).toBe(true);
  });
});

describe("validateReceiptParseSecurity", () => {
  it("checks origin and bearer token", () => {
    expect(validateReceiptParseSecurity({
      origin: "https://fintrack.example",
      requestOrigin: "https://fintrack.example",
      authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature",
    })).toEqual({ ok: true, accessToken: "eyJhbGciOiJIUzI1NiJ9.payload.signature" });

    expect(validateReceiptParseSecurity({
      origin: "https://evil.example",
      requestOrigin: "https://fintrack.example",
      authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature",
    }).ok).toBe(false);

    expect(validateReceiptParseSecurity({
      origin: "https://fintrack.example",
      requestOrigin: "https://fintrack.example",
      authorization: null,
    }).ok).toBe(false);
  });
});

describe("mapQwenFailure", () => {
  it("maps status codes to helpful messages", () => {
    expect(mapQwenFailure(429).status).toBe(429);
    expect(mapQwenFailure(401).status).toBe(503);
    expect(mapQwenFailure(500).status).toBe(502);
  });
});
