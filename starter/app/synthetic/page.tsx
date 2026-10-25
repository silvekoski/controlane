import { AppFrame } from "../components/app-frame";
import { SyntheticBrowser } from "./synthetic-browser";

export default function SyntheticPage() {
  return <AppFrame section="synthetic">
    <main className="flex w-full flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Synthetic data explorer</h1>
          <p className="max-w-[80ch] text-[13px] text-muted-foreground">Search and inspect generated evaluation cases, including their facts, proposed action, label and template family.</p>
        </div>
      </header>
      <SyntheticBrowser />
    </main>
  </AppFrame>;
}
