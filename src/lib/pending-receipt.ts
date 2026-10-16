import type { ReceiptExtraction } from "./receipt-vision";
let activeOwner: string | null = null;
let pending: { file: File; owner: string } | null = null;
let extraction: { value: ReceiptExtraction; owner: string } | null = null;
export function setPendingReceiptOwner(owner: string | null) {
  if (owner !== activeOwner) { pending = null; extraction = null; }
  activeOwner = owner;
}
export function clearPendingReceipt() { pending = null; extraction = null; }
export function setPendingReceipt(file: File, owner = activeOwner) { if (owner && owner === activeOwner) pending = { file, owner }; }
export function takePendingReceipt() { const value = pending; pending = null; return value?.owner === activeOwner ? value?.file ?? null : null; }
export function setPendingExtraction(value: ReceiptExtraction, owner = activeOwner) { if (owner && owner === activeOwner) extraction = { value, owner }; }
export function takePendingExtraction() { const value = extraction; extraction = null; return value?.owner === activeOwner ? value?.value ?? null : null; }
