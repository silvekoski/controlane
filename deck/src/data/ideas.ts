export type Tone = "neutral" | "teal" | "orange" | "red" | "green"

export const CRITERIA = ["Brief fit", "Bahn's pain", "Control room", "Demo w/ packet", "New idea", "Low risk"] as const

export type Idea = {
  n: number
  name: string
  short: string
  tags: [string, Tone][]
  promise: string
  today: string
  quote: string
  tag: string
  moment: string
  scores: number[] // 1 to 3, same order as CRITERIA
  xy: [number, number] // effort, value, both 0 to 1
  recommended?: boolean
  say: string
}

export const IDEAS: Idea[] = [
  { n: 1, name: "Driver carpooling", short: "Carpooling", tags: [["Dispatch", "neutral"], ["Own proposal", "orange"]],
    promise: "Shared rides make domestic gigs cheaper to sell.",
    today: "Drivers already arrange rides in a Telegram group. Bahn does not run this. Each driver travels to the car alone.",
    quote: "Drivers already arrange rides in a Telegram group. Bahn has not facilitated it, but said it could be a lever.", tag: "T3",
    moment: "Both drivers accept the match in the app. No ops person is needed unless the buffer breaks.",
    scores: [2, 2, 2, 2, 3, 2], xy: [0.75, 0.25],
    say: "Both drivers accept the match in the app. Be honest: it needs two-sided consent and a pricing change." },
  { n: 2, name: "Rail strike watch", short: "Strike watch", tags: [["Driver travel", "neutral"]],
    promise: "Find out about the strike before the train fails.",
    today: "A strike on a train leg breaks the driver's trip to the car. Someone finds out late and re-plans by hand.",
    quote: "Strikes in Central Europe were named as useful to monitor. Deutsche Bahn was called \"the final boss\".", tag: "T2",
    moment: "A person approves only if the new plan costs more than a limit or moves the pickup date.",
    scores: [3, 2, 3, 3, 2, 3], xy: [0.18, 0.6],
    say: "Approve only on cost over limit or a moved pickup date. The driver is told without a yes." },
  { n: 3, name: "Scooters for the last kilometer", short: "Scooters", tags: [["Driver travel", "neutral"]],
    promise: "Correct arrival times where Google Routes guesses wrong.",
    today: "The last leg is planned with Google Routes. Scooters are not in the system, so times for short hops are off.",
    quote: "Scooters are not in the system yet. Bahn said it \"would be sick\". The last leg uses Google Routes today.", tag: "T2",
    moment: "None in the normal case. The driver chooses. We say this plainly.",
    scores: [2, 1, 1, 2, 2, 3], xy: [0.15, 0.25],
    say: "No human moment in the normal case. We flag this honestly." },
  { n: 4, name: "GPS stop check", short: "GPS stop check", tags: [["On the road", "teal"]],
    promise: "Every long stop gets checked. People see only the real ones.",
    today: "Long stops on the road are hard to judge. Most are harmless. A few are a breakdown that puts the delivery at risk.",
    quote: "Bahn does not use agents for monitoring yet. A places lookup on long stops would be interesting for this challenge.", tag: "T3",
    moment: "Breakdown or delivery at risk: one decision card. A customer message goes out only after approval.",
    scores: [3, 3, 3, 3, 2, 3], xy: [0.15, 0.75], recommended: true,
    say: "This is the brief's own Bentley example, built. Say that out loud." },
  { n: 5, name: "Check-in before GPS starts", short: "Check-in", tags: [["On the road", "teal"], ["Live monitoring", "neutral"]],
    promise: "Know a driver is moving hours before tracking is allowed.",
    today: "GPS starts about one hour before pickup. For far pickups that is too late to see a problem.",
    quote: "GPS turns on about an hour before pickup because drivers dislike earlier tracking. Bahn suggested in-app notifications.", tag: "T3",
    moment: "No answer after the reminder: repost the gig, or ask the pickup place to move the slot.",
    scores: [3, 2, 3, 3, 3, 3], xy: [0.3, 0.68], recommended: true,
    say: "Flight status is already known, so the agent asks no question about it." },
  { n: 6, name: "Plug-in car data stick", short: "Data stick", tags: [["On the road", "teal"], ["Own proposal", "orange"], ["Needs hardware", "red"]],
    promise: "The decision card shows the exact fault, not a blurry photo.",
    today: "A driver sends a photo of a warning light. The ops person guesses the fault and its severity.",
    quote: "Manufacturer APIs cost around 100 EUR per car. Bahn was unsure about a stick, but said it would be great if it works.", tag: "T2",
    moment: "The same decision card as idea 4, now with a fault code and a severity.",
    scores: [2, 2, 2, 1, 3, 1], xy: [0.78, 0.72],
    say: "Open question: may a driver plug a device into a customer car?" },
  { n: 7, name: "Voice agent for ferry and airline desks", short: "Voice desk", tags: [["Driver travel", "neutral"]],
    promise: "The agent makes the boring phone call and brings back options.",
    today: "Someone calls a ferry or airline desk to ask for space, a new slot or a name change.",
    quote: "Voice agents already call pickup places, not travel desks. Bahn said this is usually a small need, since most changes work online.", tag: "T3",
    moment: "A person picks one of the collected options. The agent then calls back to confirm.",
    scores: [2, 1, 2, 2, 1, 2], xy: [0.4, 0.3],
    say: "Pick one collected option. The agent calls back to confirm." },
  { n: 8, name: "Judge every run with Jev", short: "Judge every run", tags: [["Learning layer", "orange"], ["Sits under any agent", "neutral"]],
    promise: "Every rejection and odd run becomes the next eval, automatically.",
    today: "Knowledge sits in people's heads. New eval cases come from hand-labeling, which does not scale.",
    quote: "Bahn's biggest stated eval pain: get knowledge out of people's heads and find new eval cases at scale, with no hand-labeling.", tag: "T2",
    moment: "The operator's \"Reject + why\" on any decision card. Area experts see only unclear drafts.",
    scores: [1, 3, 2, 2, 3, 2], xy: [0.38, 0.9], recommended: true,
    say: "This is not an ops-area agent on its own. It needs one of ideas 1 to 7 to judge." },
]
