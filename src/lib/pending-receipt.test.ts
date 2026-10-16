import { afterEach, describe, expect, it } from "vitest";
import { setPendingReceiptOwner, setPendingReceipt, takePendingReceipt, setPendingExtraction, takePendingExtraction } from "./pending-receipt";
import type { ReceiptExtraction } from "./receipt-vision";

afterEach(() => setPendingReceiptOwner(null));
describe("in-memory receipt owner isolation", () => {
  it("clears the outgoing owner's file and extraction on account change", () => {
    setPendingReceiptOwner("A");
    setPendingReceipt(new File(["private"], "a.png"), "A");
    setPendingExtraction({ merchant: "A private merchant" } as ReceiptExtraction, "A");
    setPendingReceiptOwner("B");
    expect(takePendingReceipt()).toBeNull();
    expect(takePendingExtraction()).toBeNull();
  });
  it("rejects an asynchronous scan response from the previous owner", () => {
    setPendingReceiptOwner("B");
    setPendingReceipt(new File(["private"], "a.png"), "A");
    setPendingExtraction({ merchant: "A private merchant" } as ReceiptExtraction, "A");
    expect(takePendingReceipt()).toBeNull();
    expect(takePendingExtraction()).toBeNull();
  });
  it("allows same-owner navigation once and rejects unauthenticated data", () => {
    setPendingReceiptOwner("A");
    const file = new File(["private"], "a.png");
    setPendingReceipt(file, "A");
    expect(takePendingReceipt()).toBe(file);
    expect(takePendingReceipt()).toBeNull();
    setPendingReceiptOwner(null);
    setPendingReceipt(file, "A");
    expect(takePendingReceipt()).toBeNull();
  });
});
