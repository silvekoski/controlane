import fs from "node:fs";
import path from "node:path";

// The packet is a fixed snapshot. We load the JSONL files once and index them.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>;

export const SNAPSHOT_AT = "2026-10-21T09:00:00Z";

function findDataDir(): string {
  const candidates = [
    process.env.DATASET_DIR,
    path.resolve(process.cwd(), "../dataset/data"),
    path.resolve(process.cwd(), "dataset/data"),
  ].filter(Boolean) as string[];
  for (const dir of candidates) if (fs.existsSync(path.join(dir, "orders.jsonl"))) return dir;
  throw new Error("Cannot find dataset/data. Run the app from control-room/ inside the challenge packet.");
}

export const DATA_DIR = findDataDir();
export const ATTACHMENTS_DIR = path.resolve(DATA_DIR, "../../attachments");

function load(name: string): Row[] {
  const file = path.join(DATA_DIR, `${name}.jsonl`);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

const TABLES = [
  "orders", "customers", "drivers", "vehicles", "order_items", "addresses", "sites",
  "transport_plans", "transport_points", "transport_segments", "time_windows",
  "work_assignments", "assignment_steps", "tracking_observations", "alerts", "incidents",
  "travel_options", "travel_reservations", "messages", "conversations", "work_items",
  "agent_proposals", "operational_events", "order_endpoint_details", "documents", "proofs",
  "expenses", "ferry_terminals", "ferry_terminal_events", "terminal_road_estimates",
] as const;

type TableName = (typeof TABLES)[number];

class Dataset {
  t = {} as Record<TableName, Row[]>;
  byId = new Map<string, { table: TableName; row: Row }>();
  orderByRef = new Map<string, Row>();
  orderById = new Map<string, Row>();

  constructor() {
    for (const name of TABLES) {
      this.t[name] = load(name);
      for (const row of this.t[name]) if (row.id) this.byId.set(row.id, { table: name, row });
    }
    for (const o of this.t.orders) {
      this.orderByRef.set(o.reference, o);
      this.orderById.set(o.id, o);
    }
  }

  get(id: string | null | undefined): Row | undefined {
    return id ? this.byId.get(id)?.row : undefined;
  }

  tableOf(id: string): string | undefined {
    return this.byId.get(id)?.table;
  }

  forOrder(table: TableName, orderId: string): Row[] {
    return this.t[table].filter((r) => r.order_id === orderId);
  }

  order(refOrId: string): Row | undefined {
    return this.orderByRef.get(refOrId) ?? this.orderById.get(refOrId);
  }

  primaryVehicle(orderId: string): Row | undefined {
    const item = this.t.order_items.find((i) => i.order_id === orderId && i.role === "PRIMARY");
    return this.get(item?.vehicle_id);
  }

  activeAssignment(orderId: string): Row | undefined {
    const live = this.forOrder("work_assignments", orderId).filter((a) => !a.cancelled_at);
    return live.find((a) => a.status === "IN_PROGRESS") ?? live.find((a) => a.status === "ASSIGNED") ?? live[0];
  }

  deliveryPromise(orderId: string): Row | undefined {
    return this.forOrder("time_windows", orderId).find(
      (w) => w.is_selected && (w.purpose === "CUSTOMER_DELIVERY_PROMISE" || w.purpose === "SELECTED_DELIVERY_SLOT"),
    );
  }

  pickupSlot(orderId: string): Row | undefined {
    return this.forOrder("time_windows", orderId).find((w) => w.is_selected && w.purpose === "SELECTED_PICKUP_SLOT");
  }

  // The driver's next booked gigs after this order: the chained work.
  chainedGigs(driverId: string, excludeOrderId: string): Row[] {
    return this.t.work_assignments
      .filter((a) => a.driver_id === driverId && a.order_id !== excludeOrderId && !a.cancelled_at && a.status === "ASSIGNED")
      .map((a) => ({ ...a, pickup: this.pickupSlot(a.order_id), order: this.get(a.order_id) }));
  }
}

let cached: Dataset | null = null;
export function data(): Dataset {
  if (!cached) cached = new Dataset();
  return cached;
}

export function addressLabel(addressId: string | null | undefined): string {
  const a = data().get(addressId);
  if (!a) return "Unknown address";
  return `${a.name ?? a.address_line1 ?? ""}, ${a.city}`.replace(/^, /, "");
}
