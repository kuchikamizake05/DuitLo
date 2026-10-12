let pending:File|null=null;
export function setPendingReceipt(file:File){pending=file;}
export function takePendingReceipt(){const file=pending;pending=null;return file;}

import type {ReceiptExtraction} from "./receipt-vision";
let extraction:ReceiptExtraction|null=null;
export function setPendingExtraction(value:ReceiptExtraction){extraction=value;}
export function takePendingExtraction(){const value=extraction;extraction=null;return value;}
