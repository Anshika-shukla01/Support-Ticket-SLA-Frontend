import { useState } from "react";
import { gql } from "graphql-request";
import { graphqlClient } from "../api/graphql";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type CreatedTicket = { id: string; title: string; priority: Priority; status: string; slaDeadline: string; slaStatus: string };
type Props = { onCreated: () => void };

const CREATE_TICKET = gql`
  mutation CreateTicket($title: String!, $description: String!, $priority: TicketPriority!) {
    createTicket(title: $title, description: $description, priority: $priority) {
      id title priority status slaDeadline slaStatus
    }
  }
`;

export default function CreateTicket({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) return setError("Title and description are required.");
    setError(""); setLoading(true);
    try {
      await graphqlClient.request<{ createTicket: CreatedTicket }>(CREATE_TICKET, {
        title: title.trim(), description: description.trim(), priority,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^GraphQL Error:\s*/i, "") : "Could not create ticket.");
    } finally { setLoading(false); }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-heading"><p className="eyebrow">Customer request</p><h2>Create a ticket</h2><p>Give the support team enough context to act quickly.</p></div>
      {error && <div className="alert error">{error}</div>}
      <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unable to access billing portal" maxLength={200} required /></label>
      <label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue, impact and anything you have already tried..." rows={6} required /></label>
      <label>Priority<select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}><option value="LOW">Low · 48h SLA</option><option value="MEDIUM">Medium · 24h SLA</option><option value="HIGH">High · 8h SLA</option><option value="URGENT">Urgent · 4h SLA</option></select></label>
      <button className="primary-button full" disabled={loading}>{loading ? "Creating…" : "Create ticket"}</button>
    </form>
  );
}
