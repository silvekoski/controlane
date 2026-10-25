import { createRoot } from "react-dom/client"
import "@fontsource/poppins/400.css"
import "@fontsource/poppins/500.css"
import "@fontsource/poppins/600.css"
import "@fontsource/unbounded/500.css"
import "@fontsource/unbounded/600.css"
import "@fontsource/unbounded/700.css"
import "@fontsource/reddit-mono/400.css"
import "@fontsource/reddit-mono/500.css"
import "./styles.css"
import { Deck } from "./Deck"

createRoot(document.getElementById("root")!).render(<Deck />)
