import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Controlane",
  description: "A control room where operators approve the decisions of an on-the-road car delivery agent. A Bahn hackathon project.",
}

export const viewport: Viewport = { themeColor: "#f9f9fa", width: "device-width", initialScale: 1 }

const THEME_SCRIPT = `try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before the first paint. Light is the default. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-svh antialiased">{children}</body>
    </html>
  )
}
