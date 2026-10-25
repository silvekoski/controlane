import type { ToneName } from "../theme"

export const IDEAS: { n: number; name: string; tags: [string, ToneName][]; sub: string; scores: number[] }[] = [
  { n: 1, name: "Driver carpooling", tags: [["Dispatch", "neutral"], ["Own proposal", "orange"]], sub: "Shared rides make domestic gigs cheaper to sell.", scores: [2, 2, 2, 2, 3, 2] },
  { n: 2, name: "Rail strike watch", tags: [["Driver travel", "neutral"]], sub: "Find out about the strike before the train fails.", scores: [3, 2, 3, 3, 2, 3] },
  { n: 3, name: "Scooters for the last kilometer", tags: [["Driver travel", "neutral"]], sub: "Correct arrival times where Google Routes guesses wrong.", scores: [2, 1, 1, 2, 2, 3] },
  { n: 4, name: "GPS stop check", tags: [["On the road", "teal"]], sub: "Every long stop gets checked. People see only the real ones.", scores: [3, 3, 3, 3, 2, 3] },
  { n: 5, name: "Check-in before GPS starts", tags: [["On the road", "teal"], ["Live monitoring", "neutral"]], sub: "Know a driver is moving hours before tracking is allowed.", scores: [3, 2, 3, 3, 3, 3] },
  { n: 6, name: "Plug-in car data stick", tags: [["On the road", "teal"], ["Own proposal", "orange"], ["Needs hardware", "red"]], sub: "The decision card shows the exact fault, not a blurry photo.", scores: [2, 2, 2, 1, 3, 1] },
  { n: 7, name: "Voice agent for ferry and airline desks", tags: [["Driver travel", "neutral"]], sub: "The agent makes the boring phone call and brings back options.", scores: [2, 1, 2, 2, 1, 2] },
  { n: 8, name: "Judge every run with Jev", tags: [["Learning layer", "orange"], ["Sits under any agent", "neutral"]], sub: "Every rejection and odd run becomes the next eval, automatically.", scores: [1, 3, 2, 2, 3, 2] },
]
