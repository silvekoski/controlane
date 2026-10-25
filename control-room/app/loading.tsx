// Same layout as the screens, with placeholder blocks instead of a spinner.
export default function Loading() {
  return (
    <main className="page stack-lg" aria-busy="true">
      <div className="stack">
        <div className="skel" style={{ height: 34, width: 340 }} />
        <div className="skel" style={{ height: 16, width: 460 }} />
      </div>
      <div className="panel">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="inbox-row" style={{ borderTop: i ? "1px solid var(--line)" : 0 }}>
            <div className="skel" style={{ height: 24, width: 110, borderRadius: 999 }} />
            <div className="stack" style={{ gap: 6 }}>
              <div className="skel" style={{ height: 18, width: "80%" }} />
              <div className="skel" style={{ height: 12, width: "45%" }} />
            </div>
            <div className="skel" style={{ height: 20, width: 80 }} />
          </div>
        ))}
      </div>
    </main>
  );
}
