import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page page-narrow">
      <div className="panel empty">
        <p className="empty-title">This page does not exist.</p>
        <p>The card or order may have been cleared by a reset.</p>
        <p style={{ marginTop: 16 }}><Link href="/" className="link">Back to the queue</Link></p>
      </div>
    </main>
  );
}
