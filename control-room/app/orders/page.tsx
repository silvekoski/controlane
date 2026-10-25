import Link from "next/link";
import { data } from "@/lib/data";
import { viewState } from "@/lib/history";
import { orderBasics } from "@/lib/view";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { NEW: "Preparing", WAITING_FOR_PICKUP: "Waiting for pickup", IN_TRANSIT: "On the road", DELIVERED: "Delivered" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show = "road" } = await searchParams;
  const s = viewState();
  const open = new Set(s.cards.filter((c) => c.status === "new" || c.status === "changed").map((c) => c.orderId));
  const orders = data().t.orders.filter((o) => (show === "all" ? true : o.status === "IN_TRANSIT" || o.status === "WAITING_FOR_PICKUP"));
  orders.sort((a, b) => Number(open.has(b.id)) - Number(open.has(a.id)) || a.reference.localeCompare(b.reference));
  return (
    <main className="page stack-lg">
      <div className="spread">
        <div className="stack">
          <h1 className="h1">Orders</h1>
          <p className="lede">Open any order to see what happened, who said what and when, and what the agent did.</p>
        </div>
        <div className="row">
          <Link className={`btn btn-sm ${show !== "all" ? "btn-primary" : ""}`} href="/orders">On the road and waiting</Link>
          <Link className={`btn btn-sm ${show === "all" ? "btn-primary" : ""}`} href="/orders?show=all">All 100</Link>
        </div>
      </div>
      <div className="panel">
        <table className="table">
          <thead><tr><th>Order</th><th>Car</th><th>Customer</th><th>Route</th><th>Status</th><th /></tr></thead>
          <tbody>
            {orders.map((o) => {
              const b = orderBasics(o.reference);
              return (
                <tr key={o.id}>
                  <td><Link className="link mono" href={`/orders/${o.reference}`}>{o.reference}</Link></td>
                  <td>{b.car}</td>
                  <td className="muted">{b.customer}</td>
                  <td className="muted">{b.pickup.split(", ").at(-1)} → {b.delivery.split(", ").at(-1)}</td>
                  <td>{STATUS[o.status] ?? o.status}</td>
                  <td>{open.has(o.id) ? <span className="pill pill-warn">Needs you</span> : <span className="pill pill-calm">On track</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
