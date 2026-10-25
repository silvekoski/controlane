import type { Metadata } from "next"
import QRCode from "qrcode"
import { LINKS } from "@/lib/deck/metrics"
import { Deck } from "./deck"

export const metadata: Metadata = { title: "Controlane pitch deck" }

/** The pitch deck. /deck#5 opens slide 5. /deck?print shows every slide for the PDF export. */
export default async function DeckPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const print = "print" in (await searchParams)
  const qr = await QRCode.toString(LINKS.siteUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M" })
  return <Deck qr={qr} print={print} />
}
