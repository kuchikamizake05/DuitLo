export type DataControlKind = "delete_account" | "export_data" | "correction" | "support";
export type DataControlRequest = { id: string; kind: DataControlKind; details: string; status: "pending" | "processing" | "completed" | "cancelled" | "rejected"; created_at: string; outcome: string | null };
export function validateDataControlRequest(kind: string, details: string) {
  if (!["delete_account", "export_data", "correction", "support"].includes(kind)) return "Select a request type.";
  if (details.trim().length > 2000) return "Details must be 2,000 characters or fewer.";
  if (kind !== "delete_account" && !details.trim()) return "Describe what you need help with.";
  return null;
}
type RequestClient = { rpc: (name: string, args: Record<string, string>) => PromiseLike<{ data: unknown; error: unknown }> };
export async function submitDataControlRequest(client: RequestClient, id: string, kind: string, details: string): Promise<DataControlRequest> {
  const invalid = validateDataControlRequest(kind, details);
  if (invalid) throw new Error(invalid);
  const { data, error } = await client.rpc("submit_data_control_request", { request_id: id, request_kind: kind, request_details: details.trim() });
  if (error || !data) throw new Error("Request not confirmed. Retry with the same details; your request ID is preserved.");
  return data as DataControlRequest;
}
