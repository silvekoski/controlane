import { TOOL_LABEL } from "@/lib/view";
import type { TraceStep } from "@/lib/types";

// One step of an agent run: a thought, a tool call, a driver reply or the outcome.
export function Step({ st }: { st: TraceStep }) {
  if (st.kind === "thought") return <li><span className="step-icon">·</span><span className="step-thought">{st.text}</span></li>;
  if (st.kind === "driver") return <li><span className="step-icon">D</span><span>Driver replied: “{st.text}”</span></li>;
  if (st.kind === "outcome") return <li><span className="step-icon" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>✓</span><b>{st.text}</b></li>;
  return (
    <li>
      <span className="step-icon">⚙</span>
      <span>
        <span className="step-tool">{TOOL_LABEL[st.tool] ?? st.tool}</span> <span className="muted small">{st.ms ? `${st.ms} ms` : ""}</span>
        <details className="raw">
          <summary>Input and result</summary>
          <pre>{JSON.stringify({ input: st.input, output: st.output }, null, 2)}</pre>
        </details>
      </span>
    </li>
  );
}
