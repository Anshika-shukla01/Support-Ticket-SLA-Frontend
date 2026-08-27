import { useEffect, useMemo, useState } from "react";
import { gql } from "graphql-request";
import { graphqlClient } from "../api/graphql";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type SLA = "ON_TRACK" | "AT_RISK" | "BREACHED";
type Ticket = { id: string; title: string; priority: Priority; status: Status; slaStatus: SLA; slaDeadline: string };
type Props = { onSelectTicket: (id: string) => void };

type Response = { tickets: { items: Ticket[]; total: number; page: number; pageSize: number; totalPages: number } };
const QUERY = gql`
  query Tickets($filter: TicketFilter, $page: Int, $pageSize: Int) {
    tickets(filter: $filter, page: $page, pageSize: $pageSize) {
      items { id title priority status slaDeadline slaStatus }
      total page pageSize totalPages
    }
  }
`;

function date(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function TicketList({ onSelectTicket }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<Status | "ALL">("ALL");
  const [priority, setPriority] = useState<Priority | "ALL">("ALL");
  const [sla, setSla] = useState<SLA | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filter = useMemo(() => ({
    ...(status !== "ALL" ? { status } : {}),
    ...(priority !== "ALL" ? { priority } : {}),
    ...(sla !== "ALL" ? { slaStatus: sla } : {}),
  }), [status, priority, sla]);

  useEffect(() => {
    let active = true;
    graphqlClient.request<Response>(QUERY, { filter, page, pageSize: 8 })
      .then((data) => { if (!active) return; setTickets(data.tickets.items); setTotal(data.tickets.total); setTotalPages(data.tickets.totalPages); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Failed to load tickets."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter, page]);


  return (
    <section className="ticket-section">
      <div className="stats-row">
        <div className="stat"><span>Total visible</span><strong>{total}</strong></div>
        <div className="stat"><span>Page</span><strong>{page} / {Math.max(totalPages, 1)}</strong></div>
        <div className="stat"><span>Showing</span><strong>{tickets.length}</strong></div>
      </div>
      <div className="filter-bar">
        <div className="filter-title"><strong>Ticket queue</strong><span>Filter by status, priority or SLA</span></div>
        <select value={status} onChange={(e) => { setStatus(e.target.value as Status | "ALL"); setPage(1); }}><option value="ALL">All statuses</option>{(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as Status[]).map((v) => <option key={v} value={v}>{label(v)}</option>)}</select>
        <select value={priority} onChange={(e) => { setPriority(e.target.value as Priority | "ALL"); setPage(1); }}><option value="ALL">All priorities</option>{(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map((v) => <option key={v} value={v}>{label(v)}</option>)}</select>
        <select value={sla} onChange={(e) => { setSla(e.target.value as SLA | "ALL"); setPage(1); }}><option value="ALL">All SLA states</option>{(["ON_TRACK", "AT_RISK", "BREACHED"] as SLA[]).map((v) => <option key={v} value={v}>{label(v)}</option>)}</select>
        {(status !== "ALL" || priority !== "ALL" || sla !== "ALL") && <button className="text-button" onClick={() => { setStatus("ALL"); setPriority("ALL"); setSla("ALL"); setPage(1); }}>Clear</button>}
      </div>
      {loading ? <div className="empty-state">Loading tickets…</div> : error ? <div className="alert error">{error}</div> : tickets.length === 0 ? <div className="empty-state"><strong>No tickets match these filters.</strong><span>Try clearing one or more filters.</span></div> : (
        <div className="ticket-table">
          <div className="table-head"><span>Ticket</span><span>Priority</span><span>Status</span><span>SLA</span><span>Deadline</span></div>
          {tickets.map((ticket) => (
            <button className="ticket-row" key={ticket.id} onClick={() => onSelectTicket(ticket.id)}>
              <div><strong>{ticket.title}</strong><small>#{ticket.id.slice(0, 8)}</small></div>
              <span className={`pill priority-${ticket.priority.toLowerCase()}`}>{label(ticket.priority)}</span>
              <span className={`pill status-${ticket.status.toLowerCase()}`}>{label(ticket.status)}</span>
              <span className={`pill sla-${ticket.slaStatus.toLowerCase()}`}>{label(ticket.slaStatus)}</span>
              <span className="deadline">{date(ticket.slaDeadline)}</span>
            </button>
          ))}
        </div>
      )}
      {totalPages > 1 && <div className="pagination"><button className="secondary-button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Previous</button><span>Page {page} of {totalPages}</span><button className="secondary-button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button></div>}
    </section>
  );
}
