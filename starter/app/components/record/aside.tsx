"use client"

import type { RecordView } from "@/lib/present/types"
import { fmtDateTime, fmtRange } from "@/lib/present/time"
import { cn } from "@/lib/utils"
import { Chip, Empty, FactList, More, TONE_TEXT, When } from "../ui"
import { KindIcon, Meta, Row, Rows, RowText, RowTitle } from "./bits"

export function FactsPanel({ view }: { view: RecordView }) {
  return <section className="flex flex-col gap-3" aria-label="Order facts">
    <FactList facts={view.header.facts} />
    {view.header.tradeIn && <RowText>Trade-in on the same order: {view.header.tradeIn.title}{view.header.tradeIn.plate ? ` · ${view.header.tradeIn.plate}` : ""}. Its return leg has its own status.</RowText>}
  </section>
}

export function WorkPanel({ view }: { view: RecordView }) {
  const { alerts, workItems, incidents } = view
  const count = alerts.length + workItems.length + incidents.length
  return <section aria-label="Alerts and work">
    {count === 0 && <Empty>No alert, work item or incident recorded.</Empty>}
    {count > 0 && <Rows>
      {incidents.map((incident) => <Row key={incident.id}>
        <RowTitle><KindIcon name="incident" className={TONE_TEXT[incident.tone]} />{incident.kindLabel} <Chip tone={incident.tone}>{incident.statusLabel}</Chip></RowTitle>
        {incident.facts.map((fact) => <RowText key={fact.label}><b>{fact.label}:</b> {fact.value}{fact.hint ? ` (${fact.hint})` : ""}</RowText>)}
        <Meta>{incident.owner && <span>Owner {incident.owner}</span>}<span>Opened <When at={incident.openedAt} /></span>{incident.resolvedAt && <span>Resolved <When at={incident.resolvedAt} /></span>}</Meta>
      </Row>)}
      {alerts.map((alert) => <Row key={alert.id}>
        <RowTitle><KindIcon name="alert" className={TONE_TEXT[alert.tone]} />{alert.signalLabel} <Chip tone={alert.tone}>{alert.statusLabel}</Chip></RowTitle>
        <RowText>{alert.summary}</RowText>
        {alert.nextAction && <RowText><b>Next:</b> {alert.nextAction}</RowText>}
        {alert.acknowledgementReason && <RowText><b>Acknowledged because:</b> {alert.acknowledgementReason}</RowText>}
        {alert.resolutionReason && <RowText><b>Resolution:</b> {alert.resolutionReason}</RowText>}
        <Meta>
          <span>{alert.severity} severity</span>
          <span>Raised <When at={alert.triggeredAt} /></span>
          {alert.owner && <span>Owner {alert.owner}</span>}
          {alert.acknowledgedAt && <span>Acknowledged <When at={alert.acknowledgedAt} /></span>}
          {alert.resolvedAt && <span>Resolved <When at={alert.resolvedAt} /></span>}
          {alert.evidenceCount > 0 && <span>{alert.evidenceCount} evidence link{alert.evidenceCount === 1 ? "" : "s"}</span>}
        </Meta>
        {alert.status === "ACKNOWLEDGED" && <Meta className="text-warning">Acknowledged is not resolved.</Meta>}
      </Row>)}
      {workItems.map((item) => <Row key={item.id}>
        <RowTitle><KindIcon name="work" className={TONE_TEXT[item.tone]} />{item.kindLabel} <Chip tone={item.tone}>{item.statusLabel}</Chip></RowTitle>
        <RowText>{item.summary}</RowText>
        {item.nextAction && <RowText><b>Next:</b> {item.nextAction}</RowText>}
        {item.outcome && <RowText><b>Outcome:</b> {item.outcome}</RowText>}
        <Meta>
          {item.owner && <span>Owner {item.owner}</span>}
          {item.priority && <span>{item.priority} priority</span>}
          {item.dueAt && <span>Due <When at={item.dueAt} snapshotAt={view.snapshotAt} relative /></span>}
          {item.closedAt && <span>Closed <When at={item.closedAt} /></span>}
          {item.sourceCount > 0 && <span>{item.sourceCount} source record{item.sourceCount === 1 ? "" : "s"}</span>}
        </Meta>
      </Row>)}
    </Rows>}
  </section>
}

export function DriversPanel({ view }: { view: RecordView }) {
  const { assignments } = view
  if (!assignments.length) return <Empty>No driver assignment recorded.</Empty>
  return <section aria-label="Drivers"><Rows>
    {assignments.map((assignment) => <Row key={assignment.id}>
      <RowTitle><KindIcon name="driver" className="text-muted-foreground" />{assignment.driver.name} <Chip tone={assignment.tone}>{assignment.statusLabel}</Chip></RowTitle>
      <Meta>
        {assignment.driverHome && <span>Home base {assignment.driverHome}</span>}
        {assignment.fee && <span>Fee {assignment.fee}</span>}
        {assignment.acceptedAt && <span>Booked <When at={assignment.acceptedAt} /></span>}
        {assignment.startedAt && <span>Started <When at={assignment.startedAt} /></span>}
        {assignment.completedAt && <span>Completed <When at={assignment.completedAt} /></span>}
        {assignment.cancelledAt && <span>Cancelled <When at={assignment.cancelledAt} />{assignment.cancellation ? ` (${assignment.cancellation})` : ""}</span>}
      </Meta>
      {assignment.history && <RowText>Prior duty: {assignment.history}</RowText>}
    </Row>)}
  </Rows></section>
}

export function MarketPanel({ view }: { view: RecordView }) {
  const { offers } = view
  return <section aria-label="Driver market">
    {offers.length === 0 && <Empty>No offer has been published for this order.</Empty>}
    {offers.length > 0 && <Rows>{offers.map((offer) => <Row key={offer.id}>
      <RowTitle><KindIcon name="offer" className="text-muted-foreground" />{offer.type === "BUNDLE" ? `Bundle offer (${offer.memberOrders.join(" and ")})` : offer.visibility === "DIRECTED" ? "Directed offer" : "Open offer"} <Chip tone={offer.tone}>{offer.statusLabel}</Chip></RowTitle>
      <Meta>
        {offer.fee && <span className="tabular-nums">{offer.fee}</span>}
        {offer.publishedAt && <span>Published <When at={offer.publishedAt} /></span>}
        {offer.acceptedAt && <span>Accepted <When at={offer.acceptedAt} /></span>}
        {offer.withdrawnAt && <span>Withdrawn <When at={offer.withdrawnAt} /></span>}
        {offer.expiresAt && offer.status === "PUBLISHED" && <span>Booking cutoff <When at={offer.expiresAt} snapshotAt={view.snapshotAt} relative /></span>}
      </Meta>
      {offer.pricingNote && <RowText>{offer.pricingNote}</RowText>}
      {offer.assumptions.length > 0 && <RowText>{offer.assumptions.join(" · ")}</RowText>}
      {offer.exposures.map((exposure) => <RowText key={exposure.id}>
        Shown to <b>{exposure.driver.name}</b>{exposure.reason ? ` (${exposure.reason})` : ""} {fmtDateTime(exposure.shownAt)} · {exposure.statusLabel.toLowerCase()}{exposure.notifiedAt ? `, notified ${fmtDateTime(exposure.notifiedAt, null, false)}` : ", notification not recorded"}{exposure.viewedAt ? `, viewed ${fmtDateTime(exposure.viewedAt, null, false)}` : ", view not recorded"}{exposure.decidedAt ? `, decided ${fmtDateTime(exposure.decidedAt, null, false)}` : exposure.expiresAt ? `, deadline ${fmtDateTime(exposure.expiresAt, null, false)}` : ""}.
      </RowText>)}
      {offer.reach && <RowText>Dispatch screening {fmtDateTime(offer.reach.checkedAt)}: {offer.reach.screened} screened, {offer.reach.suitable} provisionally suitable, {offer.reach.matched} audience matched, {offer.reach.accessible} feed accessible. A planning estimate, not proof of willingness.{offer.reach.note ? ` ${offer.reach.note}` : ""}</RowText>}
      {offer.demand && <RowText>{offer.demand.views} detail view{offer.demand.views === 1 ? "" : "s"}, {offer.demand.passes} explicit pass{offer.demand.passes === 1 ? "" : "es"}{offer.demand.windowStart ? ` between ${fmtDateTime(offer.demand.windowStart, null, false)} and ${fmtDateTime(offer.demand.windowEnd)}` : ""}. Zero views does not mean nobody saw the listing.</RowText>}
      {offer.assessment && <RowText>Operator review: {offer.assessment}.</RowText>}
    </Row>)}</Rows>}
  </section>
}

const kindIcon = (kind: string) => kind === "FERRY" ? "ferry" : kind === "TRAIN" ? "train" : kind === "FLIGHT" ? "plane" : kind === "HOTEL" ? "hotel" : "car"

export function TravelPanel({ view }: { view: RecordView }) {
  const { reservations, options, confirmations, terminalEvents } = view
  const count = reservations.length + options.length
  return <section className="flex flex-col gap-3" aria-label="Travel">
    {count === 0 && <Empty>No booking or quote recorded.</Empty>}
    {reservations.length + confirmations.length + terminalEvents.length > 0 && <Rows>
      {reservations.map((reservation) => <Row key={reservation.id}>
        <RowTitle><KindIcon name={kindIcon(reservation.kind)} className="text-muted-foreground" />{reservation.kindLabel}{reservation.route ? `: ${reservation.route}` : ""} <Chip tone={reservation.tone}>{reservation.statusLabel}</Chip></RowTitle>
        <Meta>
          {reservation.kind === "HOTEL"
            ? <span>Stay {fmtRange(reservation.departureAt, reservation.arrivalAt, null)}</span>
            : <><span>Departs <When at={reservation.departureAt} /></span>{reservation.arrivalAt && <span>Arrives <When at={reservation.arrivalAt} /></span>}</>}
          {reservation.checkInCutoffAt && <span>Check-in cutoff <When at={reservation.checkInCutoffAt} /></span>}
          {reservation.driver && <span>{reservation.driver.name}</span>}
          {reservation.reference && <span className="font-mono">{reservation.reference}</span>}
        </Meta>
        {reservation.checks.length > 0 && <RowText>{reservation.checks.join(" · ")}. A booking does not confirm travel.</RowText>}
        {reservation.amendment && <RowText className="text-warning">Carrier notice: {reservation.amendment}</RowText>}
        {reservation.stateNote && <RowText>{reservation.stateNote}</RowText>}
        {(reservation.replaces || reservation.replacedBy) && <Meta>{reservation.replaces && <span>Rebooking after an earlier reservation</span>}{reservation.replacedBy && <span>Replaced by a later reservation</span>}</Meta>}
      </Row>)}
      {confirmations.map((confirmation) => <Row key={confirmation.id}>
        <RowTitle>{confirmation.kindLabel}</RowTitle>
        <RowText>{confirmation.driver.name}: {confirmation.report}</RowText>
        <Meta><span><When at={confirmation.at} /></span><span>Driver report, not an independent confirmation</span></Meta>
      </Row>)}
      {terminalEvents.map((event) => <Row key={event.id}>
        <RowTitle><KindIcon name="ferry" className="text-danger" />{event.kindLabel}{event.terminal ? ` at ${event.terminal}` : ""}</RowTitle>
        {event.reason && <RowText>{event.reason}</RowText>}
        <Meta><span><When at={event.at} /></span>{event.note && <span>{event.note}</span>}</Meta>
      </Row>)}
    </Rows>}
    {options.length > 0 && <More label={`${options.length} quote${options.length === 1 ? "" : "s"} and capacity checks`}>
      <Rows>{options.map((option) => <Row key={option.id}>
        <RowTitle><KindIcon name={kindIcon(option.kind)} className="text-muted-foreground" />{option.kindLabel}{option.route ? `: ${option.route}` : ""} <Chip tone={option.tone}>{option.statusLabel}</Chip></RowTitle>
        <Meta>
          <span>Departs <When at={option.departureAt} /></span>
          {option.quote && <span>{option.quote}</span>}
          {option.provider && <span>{option.provider}</span>}
          <span>Checked <When at={option.checkedAt} /></span>
        </Meta>
        {option.note && <RowText>{option.note}. A quote is not a booking.</RowText>}
      </Row>)}</Rows>
    </More>}
  </section>
}

export function CostsPanel({ view }: { view: RecordView }) {
  const { expenses } = view
  const shown = expenses.slice(0, 6)
  return <section className="flex flex-col gap-3" aria-label="Costs">
    {expenses.length === 0 && <Empty>No cost claim recorded.</Empty>}
    {shown.length > 0 && <Rows>{shown.map((expense) => <ExpenseRow key={expense.id} expense={expense} />)}</Rows>}
    {expenses.length > shown.length && <More label={`${expenses.length - shown.length} earlier cost records`}>
      <Rows>{expenses.slice(shown.length).map((expense) => <ExpenseRow key={expense.id} expense={expense} />)}</Rows>
    </More>}
    {expenses.length > 0 && <Meta>Review status is separate from payment. Amounts are in the claim&apos;s own currency.</Meta>}
  </section>
}

function ExpenseRow({ expense }: { expense: RecordView["expenses"][number] }) {
  return <Row side={<span className="font-mono text-[13px] text-foreground tabular-nums">{expense.amount}</span>}>
    <RowTitle>{expense.kindLabel} <Chip tone={expense.tone}>{expense.statusLabel}</Chip></RowTitle>
    <Meta>
      {expense.claimant && <span>{expense.claimant.name}</span>}
      {expense.payer && !expense.claimant && <span>Paid by {expense.payer}</span>}
      <span>Receipt {expense.receipt}</span>
      {expense.submittedAt && <span>Submitted <When at={expense.submittedAt} /></span>}
    </Meta>
    {expense.note && <RowText>{expense.note}</RowText>}
  </Row>
}

export function SourcePanel({ view, orderId }: { view: RecordView; orderId: string }) {
  return <section className="flex flex-col gap-3" aria-label="Source records">
    {view.inboxHints.length > 0 && <Rows>{view.inboxHints.map((hint) => <Row key={hint.id}>
      <RowTitle><KindIcon name="message" className="text-muted-foreground" />Support inbox <Chip tone={hint.confirmed ? "neutral" : "warn"}>{hint.stateLabel}</Chip></RowTitle>
      <RowText>{hint.category} by {hint.channel.toLowerCase()}{hint.owner ? ` · owner ${hint.owner}` : ""}{hint.waitingOn ? ` · waiting on ${hint.waitingOn}` : ""}. {hint.confirmed ? "Confirmed link." : "A candidate match, not a confirmed link."}{hint.basis ? ` ${hint.basis}` : ""}</RowText>
    </Row>)}</Rows>}
    {view.otherRecords.length > 0 && <RowText>Also linked, not shown above: {view.otherRecords.map((record) => `${record.label.toLowerCase()} (${record.count})`).join(", ")}.</RowText>}
    <p className={cn("text-xs text-muted-foreground")}>Every field and link: <a className="underline underline-offset-4 hover:text-foreground" href={`/api/orders/${orderId}`} target="_blank" rel="noopener noreferrer">order API</a>.</p>
  </section>
}
