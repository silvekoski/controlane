// Shared types. Field names follow the PRD build spec, checked against dataset/SCHEMA.md.

export type FactSource = "gps" | "driver_chat" | "order" | "site" | "operator" | "app" | "tool";

export type Fact = {
  label: string;
  value: string;
  source: FactSource;
  observedAt: string; // ISO time, shown as age on the card
  recordId?: string; // link to the dataset record or a simulated record
  imageFile?: string; // packet path of a photo or scan behind this fact
};

export type ActionKind =
  | "rebook_ferry"
  | "rebook_train"
  | "change_date"
  | "change_cost"
  | "message_customer"
  | "message_driver"
  | "repost_gig"
  | "call_dealer"
  | "call_driver"
  | "none";

export type ProposedAction = {
  kind: ActionKind;
  description: string;
  costDelta?: number; // EUR
  needsApproval: boolean;
  travelOptionId?: string;
  customerDraft?: string; // drafted only; a person sends it
};

export type CardStatus = "new" | "approved" | "edited" | "rejected" | "changed";

export type RejectReason = "wrong_info" | "too_early" | "ask_customer" | "other";

export type DecisionCard = {
  id: string;
  orderId: string;
  orderRef: string;
  runId: string;
  status: CardStatus;
  summary: string; // one sentence: what happened and the decision needed
  deadline: string; // when a promise breaks; sorts the queue
  deadlineLabel: string;
  facts: Fact[];
  agentActions: string[];
  proposal: ProposedAction;
  checks: CheckResult[];
  createdAt: string;
  fingerprint: string; // world state the card was built on
  decidedBy?: string;
  decidedAt?: string;
  rejectReason?: RejectReason;
  rejectNote?: string; // answer to "How did you know?"
  editNote?: string;
  outcome?: string; // what happened after the decision
  stop?: StopCheck; // the GPS stop check behind the card, if any
};

export type QuestionType = "yes_no" | "choice" | "score";

export type TypedQuestion = {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  criteria?: Record<string, string>; // option -> what it means, for decision models
  trapAnswers: string[]; // answers that raise a warning on the card
  modelChecked: boolean; // false: only plain code answers it
  warning: string; // plain words for the card
  source: string; // where the question came from
  approvedBy?: string;
  version: number;
  status: "proposed" | "live" | "retired";
};

export type CheckerModel = "code" | "laya" | "laya_ft" | "jev" | "d1" | "d1_omni" | "d1_ft" | "selfjev" | "llm_judge" | "jev_vision" | "llm_judge_vision";

export type CheckResult = {
  questionId: string;
  questionVersion: number;
  model: CheckerModel;
  answer: string;
  confidence: number; // 0 to 1
  ms: number;
  costUsd?: number;
  flagged: boolean;
  message: string; // plain words shown on the card
  factLabel?: string; // the fact the warning sits next to
  blocking?: boolean; // hard rule: the action cannot run
  photoId?: string; // visual check: the photo the answer is about
};

// A photo or scan from the packet attachments, joined to the record that owns it.
export type Photo = {
  id: string;
  orderId: string;
  kind: string; // PICKUP_PHOTOS, DELIVERY_PHOTOS, MESSAGE_PHOTO, ...
  file: string; // path inside the attachments folder
  format: "jpg" | "png";
  recordType: string;
  recordId: string;
  status: string;
  capturedAt?: string;
};

// One visual decision model answer about one photo.
export type PhotoCheck = {
  photoId: string;
  questionId: string;
  model: CheckerModel;
  answer: string;
  confidence: number; // 0 to 1
  ms: number;
  costUsd?: number;
  flagged: boolean; // trap answer and sure enough to warn
  unsure: boolean; // too unsure: a person looks at the photo
  message: string;
  checkedAt: string;
};

export type TraceStep =
  | { kind: "thought"; at: string; text: string }
  | { kind: "tool"; at: string; tool: string; input: unknown; output: unknown; ms: number }
  | { kind: "driver"; at: string; text: string }
  | { kind: "outcome"; at: string; text: string };

export type AgentRun = {
  id: string;
  orderId: string;
  orderRef: string;
  scenarioId: string;
  trigger: string;
  mode: "llm" | "scripted";
  model?: string;
  status: "running" | "quiet" | "card" | "failed";
  startedAt: string;
  endedAt?: string;
  steps: TraceStep[];
  cardId?: string;
  quietReason?: string;
  error?: string;
  operatorInstruction?: string;
  usage?: { inputTokens: number; outputTokens: number };
  stop?: StopCheck; // set by the stop check tools on a long-stop event
};

// One sub-agent decision: the state at that moment and the action.
export type DecisionTrace = {
  id: string;
  orderId: string;
  agent: string;
  state: Fact[];
  action: ProposedAction | { tool: string; input: unknown };
  reasoning?: string;
  createdAt: string;
};

export type EvalCase = {
  id: string;
  traceId?: string;
  title: string;
  state: Fact[];
  action: string; // the agent action in plain words
  questionId: string;
  acceptedAnswers: string[]; // more than one when the decision has several good answers
  labeledBy: "hand" | "discovery_agent" | "operator_reject" | "synthetic";
  split: "train" | "calibration" | "test" | "test_ood"; // test_ood: templates never seen in training
  template?: string; // the template family a synthetic case came from
  at: string; // the decision moment; fact ages count from here
  image?: string; // packet path of the photo or scan the question is about
  note?: string;
};

export type EvalCandidate = {
  id: string;
  createdAt: string;
  source: "operator_reject" | "discovery_agent";
  cardId?: string;
  orderRef: string;
  questionId: string;
  question: string;
  options: string[];
  state: Fact[];
  action: string;
  suggestedAnswer?: string;
  label?: string;
  labelNote?: string;
  labeledBy?: string;
  labeledAt?: string;
};

export type ChatMessage = {
  id: string;
  orderId: string;
  at: string;
  from: "agent" | "driver" | "operator" | "customer" | "system";
  channel: "driver_chat" | "customer_email" | "internal_note";
  text: string;
  dataset?: boolean; // true for messages from the packet
};

export type GpsFix = {
  id: string;
  orderId: string;
  observedAt: string;
  receivedAt: string;
  distanceRemainingKm: number | null;
  estimatedDeliveryAt: string | null;
  quality: string;
  placeHint?: string;
  simulated?: boolean;
  lat?: number;
  lng?: number;
};

// One place near a GPS stop, from a places lookup (Google Places, or the simulated list).
export type NearbyPlace = {
  id: string;
  name: string;
  type: string; // fuel_station, ev_charging, restaurant, rest_area, car_repair, tyre_shop, parking, industrial, ...
  lat: number;
  lng: number;
  distanceM: number;
  openNow: boolean | null;
};

// Jev's ranking of one option: the share of probability it gave that option.
export type Ranked = { id: string; label: string; probability: number };

// What the stop check found: the rule that fired, the places nearby and how Jev ranked them.
export type StopCheck = {
  orderRef: string;
  fixId: string;
  lat: number;
  lng: number;
  stoppedSince: string;
  stoppedMinutes: number;
  gpsAgeMinutes: number;
  rule: string; // the rule in plain words, for the card
  provider: "google" | "simulated";
  places: NearbyPlace[];
  ranking?: {
    model: string; // "jev" or "rules" when Jev is not connected
    places: Ranked[]; // most likely first; "none" means no place explains the stop
    causes: Ranked[];
    ms: number;
    costUsd?: number;
    rankedAt: string;
    driverReplySeen: boolean;
    // Our fine-tuned models answer the same two questions. Jev drives the policy; these are a second opinion.
    others?: { model: string; label: string; places: Ranked[]; causes: Ranked[]; ms: number; costUsd?: number; error?: string }[];
  };
};

export type TimelineEvent = {
  id: string;
  orderId: string;
  at: string;
  actor: "agent" | "operator" | "system" | "driver";
  text: string;
};

export type BenchmarkRow = {
  model: CheckerModel;
  label: string;
  status: "measured" | "not_configured" | "failed";
  note?: string;
  perQuestion: Record<string, { n: number; correct: number; caught: number; traps: number; falseAlarms: number; negatives: number }>;
  catchRate?: number;
  falseAlarmRate?: number;
  calibrationError?: number;
  costPer1000?: number;
  msPerCheck?: number;
  ranAt?: string;
};
