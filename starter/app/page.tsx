import { redirect } from "next/navigation"

/** The overview is the start page. The orders board is at /orders. */
export default function Home() {
  redirect("/overview")
}
