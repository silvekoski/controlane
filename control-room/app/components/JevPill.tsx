import type { DecisionCard } from "@/lib/types";
import { jevSummary } from "@/lib/view";

// One short label with Jev's result on a card, for lists.
export function JevPill({ card }: { card: DecisionCard }) {
  const j = jevSummary(card);
  if (!j.checked) return <span className="jev-pill jev-pill-none" title="Jev did not check this card">Jev: not checked</span>;
  return (
    <span className={`jev-pill ${j.traps ? "jev-pill-trap" : "jev-pill-ok"}`} title={`Jev answered ${j.questions} questions about known traps`}>
      <b>Jev</b> {j.traps ? (j.traps === 1 ? "1 trap" : `${j.traps} traps`) : "no trap"}
    </span>
  );
}
