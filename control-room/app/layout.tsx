import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
import { Nav } from "./components/Nav";
import { Clock } from "./components/Clock";
import { clockInfo } from "@/lib/store";
import { nextEventAt } from "@/lib/feed";
import { viewState } from "@/lib/history";

export const metadata: Metadata = { title: "On the road · Bahn control room", description: "Decisions that need a person, from the on-the-road agent." };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const s = viewState();
  const clock = clockInfo(s);
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a href="/" className="brand">
            <span className="brand-mark">B</span>
            On the road <small>· control room</small>
          </a>
          <Nav />
          <div className="topbar-right">
            <span className="hide-sm">Approval limit €{s.settings.costLimitEur}: {s.settings.costLimitEur > 0 ? "the agent acts alone below it" : "every change needs a person"}</span>
            <Clock mode={clock.mode} offsetMs={clock.offsetMs} nextEventAt={nextEventAt(s)} />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
