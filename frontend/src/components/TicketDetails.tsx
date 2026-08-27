import { useEffect, useState } from "react";
import { gql } from "graphql-request";
import { graphqlClient } from "../api/graphql";

type Props = { ticketId: string; onBack: () => void };
type Agent = { id: string; name: string; email: string; role: Role };
type Role = "USER" | "AGENT" | "ADMIN";
type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type Ticket = {
  id: string; title: string; description: string; priority: string; status: TicketStatus; slaStatus: string; slaDeadline: string;
  firstResponseAt: string | null; resolvedAt: string | null; createdAt: string;
  creator: { name: string; email: string }; agent: { name: string; email: string; role: Role } | null;
  comments: { id: string; content: string; createdAt: string; author: { name: string; email: string; role: Role } }[];
};
type TicketResponse = { ticket: Ticket | null };
type MutationResponse = { updateTicketStatus: Ticket };
type CommentResponse = { createComment: { id: string; content: string; createdAt: string; author: { name: string; email: string; role: Role } } };

const QUERY = gql`query Ticket($id: ID!) { ticket(id: $id) { id title description priority status slaDeadline slaStatus firstResponseAt resolvedAt createdAt creator { name email } agent { name email role } comments { id content createdAt author { name email role } } } }`;
const AGENTS_QUERY = gql`query Agents { agents { id name email role } }`;
const ASSIGN_MUTATION = gql`mutation AssignTicket($ticketId: ID!, $agentId: ID!) { assignTicket(ticketId: $ticketId, agentId: $agentId) { id agent { name email role } status } }`;
const STATUS_MUTATION = gql`mutation UpdateStatus($ticketId: ID!, $status: TicketStatus!) { updateTicketStatus(ticketId: $ticketId, status: $status) { id status firstResponseAt resolvedAt slaStatus } }`;
const COMMENT_MUTATION = gql`mutation CreateComment($ticketId: ID!, $content: String!) { createComment(ticketId: $ticketId, content: $content) { id content createdAt author { name email role } } }`;

function date(value: string | null) { if (!value) return "Not yet"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function TicketDetails({ ticketId, onBack }: Props) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assigning, setAssigning] = useState(false);

  const currentUser = (() => { try { return JSON.parse(localStorage.getItem("user") ?? "null") as { role?: Role } | null; } catch { return null; } })();
  const canManageStatus = currentUser?.role === "AGENT" || currentUser?.role === "ADMIN";
  const canAssign = currentUser?.role === "ADMIN";

  async function load() {
    setLoading(true); setError("");
    try { const data = await graphqlClient.request<TicketResponse>(QUERY, { id: ticketId }); setTicket(data.ticket); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load ticket."); }
    finally { setLoading(false); }
  }
  // Data fetching is an external side effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [ticketId]);

  useEffect(() => {
    if (!canAssign) return;
    graphqlClient.request<{ agents: Agent[] }>(AGENTS_QUERY).then((data) => setAgents(data.agents)).catch(() => setAgents([]));
  }, [canAssign]);


  async function assignAgent(agentId: string) {
    if (!agentId) return;
    setAssigning(true); setError("");
    try {
      await graphqlClient.request(ASSIGN_MUTATION, { ticketId, agentId });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign ticket.");
    } finally { setAssigning(false); }
  }

  async function updateStatus(status: TicketStatus) {
    if (!ticket || status === ticket.status) return;
    setSaving(true); setError("");
    try { await graphqlClient.request<MutationResponse>(STATUS_MUTATION, { ticketId, status }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update status."); }
    finally { setSaving(false); }
  }

  async function addComment(event: React.FormEvent) {
    event.preventDefault(); if (!comment.trim()) return;
    setCommenting(true); setError("");
    try { await graphqlClient.request<CommentResponse>(COMMENT_MUTATION, { ticketId, content: comment.trim() }); setComment(""); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not add comment."); }
    finally { setCommenting(false); }
  }

  if (loading) return <div className="detail-page"><button className="back-button" onClick={onBack}>← Tickets</button><div className="empty-state">Loading ticket…</div></div>;
  if (error && !ticket) return <div className="detail-page"><button className="back-button" onClick={onBack}>← Tickets</button><div className="alert error">{error}</div></div>;
  if (!ticket) return <div className="detail-page"><button className="back-button" onClick={onBack}>← Tickets</button><div className="empty-state">Ticket not found.</div></div>;

  return (
    <section className="detail-page">
      <button className="back-button" onClick={onBack}>← Back to tickets</button>
      {error && <div className="alert error">{error}</div>}
      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-card">
            <div className="detail-top"><div><span className="ticket-number">Ticket #{ticket.id.slice(0, 8)}</span><h1>{ticket.title}</h1></div><span className={`pill status-${ticket.status.toLowerCase()}`}>{label(ticket.status)}</span></div>
            <div className="description"><h3>Description</h3><p>{ticket.description}</p></div>
            <div className="timeline"><div><span>Created</span><strong>{date(ticket.createdAt)}</strong></div><div><span>First response</span><strong>{date(ticket.firstResponseAt)}</strong></div><div><span>Resolved</span><strong>{date(ticket.resolvedAt)}</strong></div></div>
          </div>
          <div className="detail-card comments-card"><div className="section-title"><div><h2>Conversation</h2><span>{ticket.comments.length} {ticket.comments.length === 1 ? "message" : "messages"}</span></div></div>
            {ticket.comments.length === 0 ? <div className="empty-state compact">No comments yet.</div> : <div className="comments">{ticket.comments.map((item) => <article className="comment" key={item.id}><div className="avatar">{item.author.name.slice(0, 1).toUpperCase()}</div><div><div className="comment-meta"><strong>{item.author.name}</strong><span className="role-label">{item.author.role}</span><time>{date(item.createdAt)}</time></div><p>{item.content}</p></div></article>)}</div>}
            <form className="comment-form" onSubmit={addComment}><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Write a reply or internal update…" /><button className="primary-button" disabled={commenting || !comment.trim()}>{commenting ? "Sending…" : "Add comment"}</button></form>
          </div>
        </div>
        <aside className="detail-side">
          <div className="detail-card"><h3>SLA overview</h3><div className={`sla-banner sla-${ticket.slaStatus.toLowerCase()}`}><strong>{label(ticket.slaStatus)}</strong><span>Response target</span></div><dl><div><dt>Priority</dt><dd>{label(ticket.priority)}</dd></div><div><dt>Deadline</dt><dd>{date(ticket.slaDeadline)}</dd></div><div><dt>First response</dt><dd>{date(ticket.firstResponseAt)}</dd></div></dl></div>
          <div className="detail-card"><h3>Ticket ownership</h3><dl><div><dt>Requester</dt><dd>{ticket.creator.name}<small>{ticket.creator.email}</small></dd></div><div><dt>Assigned agent</dt><dd>{ticket.agent ? <>{ticket.agent.name}<small>{ticket.agent.email}</small></> : <span className="muted">Unassigned</span>}</dd></div></dl></div>
          {canAssign && <div className="detail-card"><h3>Assign agent</h3><label>Support agent<select value={ticket.agent?.email ?? ""} disabled={assigning} onChange={(e) => { const agent = agents.find((item) => item.email === e.target.value); if (agent) void assignAgent(agent.id); }}><option value={ticket.agent?.email ?? ""}>{ticket.agent ? ticket.agent.name : "Select an agent"}</option>{agents.filter((agent) => agent.email !== ticket.agent?.email).map((agent) => <option key={agent.id} value={agent.email}>{agent.name} · {agent.email}</option>)}</select></label><p className="helper">Assigning a ticket moves it to In Progress.</p></div>}
          {canManageStatus && <div className="detail-card"><h3>Manage lifecycle</h3><label>Status<select value={ticket.status} disabled={saving} onChange={(e) => void updateStatus(e.target.value as TicketStatus)}>{(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as TicketStatus[]).map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></label><p className="helper">Status changes are enforced by the backend based on your role and assignment.</p></div>}
        </aside>
      </div>
    </section>
  );
}
