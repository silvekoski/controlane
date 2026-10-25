import { create, hasClaude, MODELS, textOf } from "./llm";
import { scenarioForOrder } from "./scenarios";
import { allMessages, addFix, recordDriverReply } from "./world";
import type { State } from "./store";
import { data } from "./data";

// The simulated driver. One persona per test order: facts the driver knows,
// and facts the driver tells only when asked.

function replyNumber(s: State, orderId: string) {
  return allMessages(s, orderId).filter((m) => m.from === "agent" && !m.dataset).length;
}

// Writes the reply text from a snapshot of the state. Does not change the state.
export async function composeDriverReply(s: State, orderRef: string): Promise<string> {
  const order = data().order(orderRef)!;
  const persona = scenarioForOrder(orderRef)?.driver;
  if (!persona) return "OK, noted.";
  const n = replyNumber(s, order.id);
  const scripted = persona.scriptedReplies[Math.min(Math.max(n - 1, 0), persona.scriptedReplies.length - 1)] ?? "OK.";
  if (!hasClaude()) return scripted;

  const history = allMessages(s, order.id)
    .filter((m) => m.channel === "driver_chat")
    .slice(-10)
    .map((m) => `${m.from === "driver" ? "You" : "Bahn"} (${m.at}): ${m.text}`)
    .join("\n");
  const res = await create({
    model: MODELS.driver,
    max_tokens: 1000,
    output_config: { effort: "low" },
    system:
      `You play ${persona.name}, a freelance car delivery driver, in a fictional training simulation. ` +
      `Answer the Bahn operations chat in one to three short sentences, plain English, like a driver texting.\n` +
      `What you know now: ${persona.situation}\n` +
      `Tell these only if the message asks about them:\n${persona.tellOnlyWhenAsked.map((t) => `- ${t.topic}: ${t.answer}`).join("\n") || "- nothing"}\n` +
      `Do not invent facts beyond these. If asked something you do not know, say you do not know.`,
    messages: [{ role: "user", content: `Chat so far:\n${history}\n\nWrite your next reply only.` }],
  });
  return textOf(res) || scripted;
}

// Records the reply and applies its effects, for example a fresh GPS fix.
export function applyDriverReply(s: State, orderRef: string, text: string) {
  const order = data().order(orderRef)!;
  const persona = scenarioForOrder(orderRef)?.driver;
  const n = replyNumber(s, order.id);
  const msg = recordDriverReply(s, order.id, text);
  for (const e of persona?.effects ?? []) if (e.afterReply === n && e.fix) addFix(s, order.id, e.fix);
  return msg;
}
