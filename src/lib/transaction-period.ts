import { endOfMonth, format, startOfMonth } from "date-fns";
import { parseTransactionDate } from "./transaction-date";

/** Include complete calendar months so day markers remain available under date filters. */
export function transactionPeriod(start: string, end: string, today = new Date()) {
  const first = parseTransactionDate(start) ?? parseTransactionDate(end) ?? format(today, "yyyy-MM-dd");
  const last = parseTransactionDate(end) ?? first;
  return {
    start: format(startOfMonth(new Date(`${first}T12:00:00`)), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date(`${last}T12:00:00`)), "yyyy-MM-dd"),
  };
}
