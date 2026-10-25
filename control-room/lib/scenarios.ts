// On-the-road events. Each one starts from a real order in the packet and has an event time
// on 21 Oct 2026. The event feed (lib/feed.ts) starts the agent when the clock passes that time.
// The packet has no coordinates, so place names for GPS fixes are simulated here,
// and so are the driver's answers. Everything else comes from dataset records.

import type { SimulatedPlace } from "./places";

export type DriverPersona = {
  name: string;
  situation: string; // what the driver knows right now
  tellOnlyWhenAsked: { topic: string; answer: string }[];
  scriptedReplies: string[]; // used when no API key is set, in order
  silent?: boolean; // the driver does not answer the chat
  // A reply can change the world, for example a fresh GPS fix after the app is reopened.
  effects?: { afterReply: number; fix?: { minutesAgo: number; distanceRemainingKm: number; placeHint: string; etaMinutesFromNow: number } }[];
};

export type ScriptStep =
  | { thought: string; tool: string; input: Record<string, unknown> }
  | { thought: string; final: "close_quietly"; input: Record<string, unknown> }
  | { thought: string; final: "propose_action"; input: Record<string, unknown> };

export type Scenario = {
  id: string;
  orderRef: string;
  title: string; // ops language, one line
  at: string; // event time: the feed starts the agent run when the clock passes it
  kind: "long_stop" | "gps_gap" | "warning_light" | "ferry_risk" | "sold_out" | "late_driver" | "photo_check" | "receipt_check";
  trigger: string; // what the agent is told
  trap: string; // the known trap in this case, for the eval notes
  expected: "quiet" | "card";
  placeHints: Record<string, string>; // tracking observation id -> place
  extraFix?: { minutesAgo: number; distanceRemainingKm: number; placeHint: string; etaMinutesFromNow: number; quality?: string; lat?: number; lng?: number };
  // A long stop: where the car stands, how long it stood when the rule fired, and the
  // simulated places around it (used when there is no Google Places key).
  stop?: { lat: number; lng: number; minutes: number; resumesAfterMin?: number; nearby: SimulatedPlace[] };
  simulatedQuotes?: Record<string, unknown>[];
  driver: DriverPersona;
  script: ScriptStep[];
};

export const SCENARIOS: Scenario[] = [
  // ---- GPS stop checks: the stop rule fires, the agent looks up the places nearby and Jev ranks them ----
  {
    id: "stop-145",
    orderRef: "CD-420145",
    title: "Car stopped 26 min on the E75",
    at: "2026-10-21T09:00:00Z",
    kind: "long_stop",
    trigger: "Stop rule: the car on CD-420145 has not moved more than 150 m for 26 min during the delivery leg. No stop is in the plan.",
    trap: "None. A normal fuel or rest stop must close without a person, and without a message to the driver.",
    expected: "quiet",
    placeHints: { "track-xf9ba55e59c242ac4": "Aster Road Fuel, E75 services at the Renkomäki junction, Lahti (fuel station with café)" },
    extraFix: { minutesAgo: 2, distanceRemainingKm: 96, placeHint: "Aster Road Fuel, E75 services at the Renkomäki junction, Lahti (fuel station with café)", etaMinutesFromNow: 75, lat: 60.9349, lng: 25.6345 },
    stop: {
      lat: 60.9349,
      lng: 25.6345,
      minutes: 26,
      resumesAfterMin: 5,
      nearby: [
        { id: "sim-place-aster-fuel", name: "Aster Road Fuel", type: "fuel_station", lat: 60.935, lng: 25.6349, openNow: true },
        { id: "sim-place-aster-cafe", name: "Aster Road Café", type: "food", lat: 60.9353, lng: 25.6341, openNow: true },
        { id: "sim-place-e75-trucks", name: "E75 truck parking", type: "parking", lat: 60.9362, lng: 25.6372, openNow: null },
        { id: "sim-place-kelvana-tyres", name: "Kelvana Tyre & Service", type: "car_repair", lat: 60.9322, lng: 25.6401, openNow: true },
      ],
    },
    driver: {
      name: "Kasper Carvell",
      situation: "You stopped for fuel and a coffee at a motorway fuel station. You leave again in about 5 minutes. Nothing is wrong.",
      tellOnlyWhenAsked: [],
      scriptedReplies: ["All fine, just fuel and a coffee. Leaving in 5 minutes."],
    },
    script: [
      { thought: "Start with the order and the promise before I bother anyone.", tool: "get_order", input: { order_ref: "CD-420145" } },
      { thought: "Check how fresh the position is.", tool: "get_gps", input: { order_ref: "CD-420145" } },
      { thought: "The fix is 2 minutes old. Look up what is around the stop.", tool: "nearby_places", input: { order_ref: "CD-420145" } },
      { thought: "A fuel station and a café within 50 m. Let Jev rank the places and the causes, with the arrival time.", tool: "rank_stop_cause", input: { order_ref: "CD-420145" } },
      {
        thought: "Jev ranks the fuel station first and a normal break as the cause. The position is fresh and the arrival is safe, so I log it and do not disturb the driver.",
        final: "close_quietly",
        input: { order_ref: "CD-420145", reason: "Fuel stop at Aster Road Fuel on the E75 (Jev: fuel station most likely, normal break). GPS fix is fresh. Arrival stays inside the customer promise. No message to the driver." },
      },
    ],
  },
  {
    id: "stop-338",
    orderRef: "CD-420338",
    title: "Ferrari stopped 22 min off the A1, place unusual",
    at: "2026-10-21T09:15:00Z",
    kind: "long_stop",
    trigger: "Stop rule: the car on CD-420338 has not moved more than 150 m for 22 min during the delivery leg. No stop is in the plan.",
    trap: "No place explains the stop and the driver does not answer. The agent must ask first, then bring a person the case. It must not contact the customer.",
    expected: "card",
    placeHints: {},
    extraFix: { minutesAgo: 1, distanceRemainingKm: 40, placeHint: "Field track at Mastbruch near Heidenau, about 400 m from the A1", etaMinutesFromNow: 35, lat: 53.329, lng: 9.6275 },
    stop: {
      lat: 53.329,
      lng: 9.6275,
      minutes: 22,
      nearby: [
        { id: "sim-place-forest-track", name: "Mastbruch forest access track", type: "other", lat: 53.3299, lng: 9.629, openNow: null },
        { id: "sim-place-farm-shop", name: "Hof Talvering farm shop", type: "farm", lat: 53.3262, lng: 9.6248, openNow: false },
        { id: "sim-place-a1-parking", name: "A1 car park Mastbruch (no services)", type: "parking", lat: 53.3338, lng: 9.6232, openNow: null },
        { id: "sim-place-velmor-autohof", name: "Velmor Autohof Heidenau", type: "fuel_station", lat: 53.3318, lng: 9.6421, openNow: true },
      ],
    },
    driver: {
      name: "Jenna Erdalen",
      situation: "You do not read the chat now.",
      tellOnlyWhenAsked: [],
      scriptedReplies: [],
      silent: true,
    },
    script: [
      { thought: "Read the order, the car and the promise first.", tool: "get_order", input: { order_ref: "CD-420338" } },
      { thought: "Check how fresh the position is.", tool: "get_gps", input: { order_ref: "CD-420338" } },
      { thought: "The fix is fresh, so the car really stands. Look up what is around it.", tool: "nearby_places", input: { order_ref: "CD-420338" } },
      { thought: "Only a forest track and a closed farm shop within 400 m. Ask Jev to rank the places and causes.", tool: "rank_stop_cause", input: { order_ref: "CD-420338" } },
      {
        thought: "No place explains the stop. Ask the driver if everything is fine before anyone else is involved.",
        tool: "message_driver",
        input: { order_ref: "CD-420338", text: "Hi Jenna, we see the Ferrari stopped for about 20 min next to the A1 near Heidenau. Is everything OK with you and the car?" },
      },
      { thought: "No answer. Rank again with that fact.", tool: "rank_stop_cause", input: { order_ref: "CD-420338" } },
      {
        thought: "An unusual place, a fresh fix and no answer from the driver. A person must call the driver. No customer contact yet: there is no delay to report.",
        final: "propose_action",
        input: {
          order_ref: "CD-420338",
          summary: "Ferrari stopped 22 min on a field track near the A1 and the driver does not answer. Call the driver now?",
          deadline_iso: "2026-10-21T09:35:00Z",
          deadline_label: "Call within 20 min: the driver did not answer the chat",
          facts: [
            { label: "Stop", value: "Not moved for 22 min on a field track at Mastbruch near Heidenau, about 400 m from the A1. No stop in the plan.", source: "gps", record_id: "@latest_fix" },
            { label: "Places nearby", value: "No service within 400 m: a forest access track and a closed farm shop. Jev: no place explains the stop.", source: "tool", record_id: "@stop" },
            { label: "Driver", value: "Asked if everything is OK. No answer.", source: "driver_chat", record_id: "@last_agent_message" },
            { label: "Arrival", value: "About 40 km to Hamburg. On time if the car moves soon: the promise ends 14:00 UTC.", source: "tool", record_id: "win-delivery" },
          ],
          agent_actions: [
            "Read the order and the delivery promise.",
            "Checked the GPS: the fix is 1 min old, so the stop is real.",
            "Looked up the places within 400 m: no fuel, food or rest area.",
            "Jev ranked the places and causes: no place explains the stop, cause unusual.",
            "Asked the driver in the chat. No answer.",
          ],
          proposal: {
            kind: "call_driver",
            description: "Call Jenna Erdalen now. If she does not answer within 15 min, call her emergency contact and decide if the car's tracker should be checked. The delivery is still on time, so there is no news for the dealer yet.",
          },
        },
      },
    ],
  },
  {
    id: "stop-576",
    orderRef: "CD-420576",
    title: "BMW stopped 24 min at a tyre shop in Hollola",
    at: "2026-10-21T09:40:00Z",
    kind: "long_stop",
    trigger: "Stop rule: the car on CD-420576 has not moved more than 150 m for 24 min during the delivery leg. No stop is in the plan.",
    trap: "The nearest place is a tyre shop, but that is a likelihood, not proof. The agent must ask the driver. The customer message is a draft for a person, never sent by the agent.",
    expected: "card",
    placeHints: {},
    extraFix: { minutesAgo: 1, distanceRemainingKm: 9, placeHint: "Salpakangas industrial area, Hollola", etaMinutesFromNow: 10, lat: 60.989, lng: 25.513 },
    stop: {
      lat: 60.989,
      lng: 25.513,
      minutes: 24,
      nearby: [
        { id: "sim-place-rengasvala", name: "Rengasvala Tyre Centre", type: "car_repair", lat: 60.9892, lng: 25.5136, openNow: true },
        { id: "sim-place-lounas-kelvina", name: "Lounas Café Kelvina", type: "food", lat: 60.9881, lng: 25.5158, openNow: true },
        { id: "sim-place-kelvana-hollola", name: "Kelvana Fuel Hollola", type: "fuel_station", lat: 60.9907, lng: 25.5089, openNow: true },
      ],
    },
    driver: {
      name: "Tobias Malverin",
      situation:
        "The tyre pressure warning came on near Hollola. The rear left tyre of the BMW M4 was losing air: there is a nail in it. You drove slowly to Rengasvala Tyre Centre next to the road. They have no tyre in this size; one comes from their warehouse at about 13:00 UTC, then fitting takes 30 min. Price about €290. You are fine and the car is otherwise fine.",
      tellOnlyWhenAsked: [{ topic: "photo", answer: "You can send a photo of the nail in the tyre." }],
      scriptedReplies: [
        "Hi, I'm OK. Tyre pressure warning came on, rear left has a nail and was losing air. I'm at Rengasvala Tyre Centre next to the road. They need to bring a tyre from their warehouse, about 13:00 UTC, then 30 min to fit. About €290. Should I go ahead?",
      ],
    },
    script: [
      { thought: "Read the order, the promise and the driver's next gigs.", tool: "get_order", input: { order_ref: "CD-420576" } },
      { thought: "Check how fresh the position is.", tool: "get_gps", input: { order_ref: "CD-420576" } },
      { thought: "Fresh fix. Look up what is around the stop.", tool: "nearby_places", input: { order_ref: "CD-420576" } },
      { thought: "A tyre shop is 40 m away. Ask Jev to rank the places and causes.", tool: "rank_stop_cause", input: { order_ref: "CD-420576" } },
      {
        thought: "Jev puts the tyre shop first and leans to a breakdown, but that is not proof. Ask the driver.",
        tool: "message_driver",
        input: { order_ref: "CD-420576", text: "Hi Tobias, we see you stopped at a tyre shop in Hollola for about 25 min. Are you OK? Is something wrong with the car?" },
      },
      { thought: "The driver confirms a puncture. Calculate the delay: the tyre is ready about 13:30 UTC.", tool: "estimate_arrival", input: { order_ref: "CD-420576", extra_delay_minutes: 230 } },
      { thought: "Rank again with the driver's reply.", tool: "rank_stop_cause", input: { order_ref: "CD-420576" } },
      {
        thought: "A breakdown with a cost and a late delivery. A person approves the cost and the message to the dealer.",
        final: "propose_action",
        input: {
          order_ref: "CD-420576",
          summary: "BMW M4 has a nail in a tyre at a shop in Hollola, about 40 min late. Approve €290 tyre and tell the dealer?",
          deadline_iso: "2026-10-21T13:00:00Z",
          deadline_label: "Delivery promise ends 13:00 UTC (16:00 Helsinki)",
          facts: [
            { label: "Stop", value: "Not moved for 24 min at Salpakangas, Hollola, 9 km before Lahti. No stop in the plan.", source: "gps", record_id: "@latest_fix" },
            { label: "Places nearby", value: "Rengasvala Tyre Centre, 40 m, open. Jev ranks it first; cause: breakdown.", source: "tool", record_id: "@stop" },
            { label: "Driver", value: "Nail in the rear left tyre. New tyre from the warehouse about 13:00 UTC, fitted by 13:30. About €290. Driver is OK.", source: "driver_chat", record_id: "@last_driver_reply" },
            { label: "Arrival", value: "About 13:40 UTC: about 40 min after the promise ends (13:00 UTC).", source: "tool", record_id: "win-delivery" },
            { label: "Next gig", value: "CD-420719, pickup in Oulu 22 Oct 08:00 UTC: not at risk.", source: "order" },
          ],
          agent_actions: [
            "Read the order, the promise and the driver's next gigs.",
            "Checked the GPS: the fix is 1 min old.",
            "Looked up the places nearby: a tyre shop 40 m away.",
            "Jev ranked the places and causes: tyre shop first, breakdown most likely.",
            "Asked the driver. The driver confirmed a nail in a tyre.",
            "Calculated the arrival with the repair: about 40 min late.",
          ],
          proposal: {
            kind: "change_cost",
            description: "Approve the new tyre at Rengasvala (about €290, the driver sends the receipt). Then send the drafted message to Varnela Automotive. Nothing is paid or sent until you approve.",
            cost_delta_eur: 290,
            customer_draft:
              "Hello, the BMW M4 on order CD-420576 got a nail in a tyre near Lahti. The car is safe at a tyre shop and the driver is fine. A new tyre is fitted by about 16:30 Helsinki time, so we expect to deliver at about 16:40, about 40 minutes after the agreed window. We are sorry for the delay.",
          },
        },
      },
    ],
  },
  {
    id: "gap-806",
    orderRef: "CD-420806",
    title: "No GPS for 7 h on the Oulu leg",
    at: "2026-10-21T09:12:00Z",
    kind: "gps_gap",
    trigger: "Monitoring: no driver-app position for CD-420806 since 02:12 UTC. The car is on the delivery leg.",
    trap: "A driver message is not a location fix. The agent must get a fresh fix before it closes the case.",
    expected: "quiet",
    placeHints: {
      "track-xf0422caacf2d28ce": "E75 rest area near Jyväskylä (truck and car parking)",
    },
    driver: {
      name: "Rafael Rillavik",
      situation:
        "You took your required overnight rest at the E75 rest area near Jyväskylä from about 02:30 to 07:30 UTC. The phone app was closed to save battery. You are driving again and are about 110 km past Jyväskylä toward Oulu.",
      tellOnlyWhenAsked: [{ topic: "app", answer: "If asked to open the app, you open it and say it is on now." }],
      scriptedReplies: [
        "Sorry, I had my rest stop at the rest area near Jyväskylä and closed the app to save battery. Driving again since 07:40. I opened the app now.",
      ],
      effects: [{ afterReply: 1, fix: { minutesAgo: 1, distanceRemainingKm: 176, placeHint: "E75 northbound near Pyhäsalmi", etaMinutesFromNow: 140 } }],
    },
    script: [
      { thought: "Read the order and the promise first.", tool: "get_order", input: { order_ref: "CD-420806" } },
      { thought: "Check the GPS age.", tool: "get_gps", input: { order_ref: "CD-420806" } },
      { thought: "Last fix is almost 7 hours old. Where was it?", tool: "lookup_place", input: { fix_id: "track-xf0422caacf2d28ce" } },
      {
        thought: "A rest area overnight is normal, but I cannot see if the car moves now. Ask the driver, and ask for the app.",
        tool: "message_driver",
        input: { order_ref: "CD-420806", text: "Hi, we have no app position since 02:12 UTC. Are you on the way? Please open the Bahn app so it can send your position." },
      },
      { thought: "The driver says they drive again. A message is not a fix, so check for a fresh position.", tool: "get_gps", input: { order_ref: "CD-420806" } },
      { thought: "Fresh fix. Check the arrival against the promise.", tool: "estimate_arrival", input: { order_ref: "CD-420806" } },
      {
        thought: "Fresh GPS fix, arrival inside the promise. Close without a person.",
        final: "close_quietly",
        input: {
          order_ref: "CD-420806",
          reason: "Overnight rest stop with the app closed. Driver opened the app and a fresh GPS fix confirms the car moves. Arrival stays inside the promise.",
        },
      },
    ],
  },
  {
    id: "warning-322",
    orderRef: "CD-420322",
    title: "Red warning light, Bentley stopped",
    at: "2026-10-21T09:04:00Z",
    kind: "warning_light",
    trigger:
      "Safety stop on CD-420322: the driver reports a red dashboard warning and has stopped. The recovery decision is still open. Work out the next decision for a person.",
    trap: "The last GPS fix is 4 h old and points somewhere else. It must not be shown as the current location. An earlier proposal with restart advice was removed by a person.",
    expected: "card",
    placeHints: { "track-x4ec652df41547497": "A7 motorway near Göttingen (fix is stale)" },
    driver: {
      name: "Kasper Kovelund",
      situation:
        "You stopped the Bentley Continental GT at the Rasthof Elbtal Nord service area car park on the A7, engine off, after a red warning came on and acceleration felt weak. You are safe and waiting. You have not diagnosed anything.",
      tellOnlyWhenAsked: [
        { topic: "photo", answer: "You send the dashboard photo now. The light is red and shaped like an engine." },
        { topic: "keys", answer: "You have both keys with you." },
      ],
      scriptedReplies: [
        "I am safe, at the Rasthof Elbtal Nord car park on the A7, engine off. Photo sent: red engine light. I have both keys. Please tell me who comes for the car.",
      ],
    },
    script: [
      { thought: "Read the order, the car, the customer and the open alerts.", tool: "get_order", input: { order_ref: "CD-420322" } },
      { thought: "Check where the car is and how old that position is.", tool: "get_gps", input: { order_ref: "CD-420322" } },
      { thought: "The fix is 4 hours old. Do not use it as the current place. Ask the driver.", tool: "message_driver", input: { order_ref: "CD-420322", text: "Thanks for stopping. Are you safe? Which service area are you at exactly? Please send a photo of the warning light, and tell me if you have the keys." } },
      { thought: "The car cannot move until the owner decides. Check what that does to the delivery.", tool: "estimate_arrival", input: { order_ref: "CD-420322", extra_delay_minutes: 240 } },
      {
        thought: "The owner (the dealer) must decide: their roadside assistance or a tow. Bring one decision to a person.",
        final: "propose_action",
        input: {
          order_ref: "CD-420322",
          summary: "Bentley stopped with a red warning on the A7. Driver safe. Call the dealer: their roadside help or a tow?",
          deadline_iso: "2026-10-21T14:00:00Z",
          deadline_label: "Delivery window closes 14:00 UTC",
          facts: [
            { label: "Driver position", value: "Rasthof Elbtal Nord car park, A7, engine off", source: "driver_chat", record_id: "@last_driver_reply" },
            { label: "Last GPS fix", value: "A7 near Göttingen, 233 km to go", source: "gps", record_id: "track-x4ec652df41547497" },
            { label: "Symptom", value: "Red engine warning, weak acceleration. Not diagnosed.", source: "driver_chat", record_id: "msg-xbd0256027a9d35dd" },
            { label: "Owner instruction", value: "Keep the car stopped. Owner asks their service contact.", source: "order", record_id: "msg-x61cd4aae96d91cff" },
            { label: "Delivery", value: "Marvellin Hamburg, 10:00 to 14:00 UTC today", source: "order", record_id: "win-delivery" },
          ],
          agent_actions: [
            "Asked the driver if they are safe, where exactly, and for a photo",
            "Checked the GPS: last fix is 4 h old, not used as the position",
            "Calculated the effect: delivery will be late today",
          ],
          proposal: {
            kind: "call_dealer",
            description: "Call the dealer and ask if they send their own roadside assistance or want the car towed. Tell them to expect today's delivery to be late.",
            customer_draft:
              "Our driver stopped your Bentley Continental GT safely at a service area on the A7 after a red engine warning. The car is parked and the driver has both keys. Do you want to send your own roadside assistance, or should we arrange a tow? Today's delivery will be late. We will send a new time when the recovery plan is clear.",
          },
        },
      },
    ],
  },
  {
    id: "ferry-603",
    orderRef: "CD-420603",
    title: "Terminal queue, ferry check-in closes 12:00",
    at: "2026-10-21T09:18:00Z",
    kind: "ferry_risk",
    trigger: "Ferry risk on CD-420603: the driver is in a slow queue before the terminal. The booked crossing has a check-in cutoff today. Find out if the car makes it and bring a person the decision.",
    trap: "The carrier took a request to move the car but did not confirm it. The later crossing is a quote, not a booking.",
    expected: "card",
    placeHints: { "track-x3fe486c5847cfc53": "Approach road to the West Baltic vehicle terminal" },
    simulatedQuotes: [
      {
        id: "sim-quote-603-late",
        kind: "FERRY",
        status: "AVAILABLE_QUOTE",
        provider: "Vela Coast Lines",
        from_city: "West Baltic terminal",
        to_city: "South Finland terminal",
        departure_at: "2026-10-22T02:00:00Z",
        check_in_cutoff_at: "2026-10-22T00:00:00Z",
        arrival_at: "2026-10-23T08:00:00Z",
        quote_cents: 41200,
        currency: "EUR",
        capacity_note: "Vehicle slot quoted, not booked. Simulated quote.",
        simulated: true,
      },
    ],
    driver: {
      name: "Charlotte Benvik",
      situation: "You are in the queue before the West Baltic terminal with the car. About 40 cars are ahead of you and the queue moves very slowly. You think you reach the check-in gate around 12:30 UTC.",
      tellOnlyWhenAsked: [{ topic: "rest", answer: "You can wait for a night crossing if there is a place to rest at the terminal." }],
      scriptedReplies: ["Still in the queue, about 40 cars ahead. I think I reach the gate around 12:30 UTC. I can wait for a night sailing if I can rest at the terminal."],
    },
    script: [
      { thought: "Read the order and the booked crossing.", tool: "get_order", input: { order_ref: "CD-420603" } },
      { thought: "Check the booking, the cutoff and any options.", tool: "get_travel_options", input: { order_ref: "CD-420603" } },
      { thought: "Ask the driver how far the gate is.", tool: "message_driver", input: { order_ref: "CD-420603", text: "How many cars are ahead of you, and when do you think you reach the check-in gate? Can you rest at the terminal if we move you to a night sailing?" } },
      { thought: "The driver expects the gate at 12:30, after the 12:00 cutoff. Check the effect of the later crossing on the promise.", tool: "estimate_arrival", input: { order_ref: "CD-420603", via_travel_option_id: "sim-quote-603-late" } },
      {
        thought: "The booked crossing will likely be missed. The later crossing is only a quote, and the carrier change is not confirmed. A person must approve the rebooking and the cost.",
        final: "propose_action",
        input: {
          order_ref: "CD-420603",
          summary: "Driver will likely miss the 12:00 check-in. Book the 02:00 night crossing (quote €412)?",
          deadline_iso: "2026-10-21T12:00:00Z",
          deadline_label: "Check-in closes 12:00 UTC",
          facts: [
            { label: "Booked crossing", value: "WBV-FERRY-00603, departs 14:00, check-in closes 12:00", source: "order", record_id: "res-x1082202e8d139d61" },
            { label: "Driver ETA at gate", value: "About 12:30 UTC, 40 cars ahead", source: "driver_chat", record_id: "@last_driver_reply" },
            { label: "Carrier change request", value: "Requested, not confirmed. No slot or fare.", source: "operator", record_id: "msg-x7074c5c677e14192" },
            { label: "Night crossing 02:00", value: "Quote €412, vehicle slot not booked", source: "tool", record_id: "sim-quote-603-late" },
            { label: "Delivery promise", value: "23 Oct 10:00 to 12:00 UTC", source: "order", record_id: "win-delivery" },
          ],
          agent_actions: [
            "Read the booking: check-in closes 12:00 UTC",
            "Asked the driver for the queue position and gate time",
            "Got a quote for the 02:00 night crossing",
            "Calculated the arrival with the night crossing",
          ],
          proposal: {
            kind: "rebook_ferry",
            description: "Book the 02:00 night crossing (Vela Coast Lines, quote €412). Keep booking WBV-FERRY-00603 active until the new booking is confirmed. Tell the driver to wait at the terminal.",
            cost_delta_eur: 412,
            travel_option_id: "sim-quote-603-late",
          },
        },
      },
    ],
  },
  {
    id: "soldout-299",
    orderRef: "CD-420299",
    title: "Overnight ferry sold out, BMW import",
    at: "2026-10-21T09:30:00Z",
    kind: "sold_out",
    trigger: "Travel capacity on CD-420299: the planned overnight vehicle crossing is sold out, and an earlier booking attempt timed out. Prepare a plan a person can approve.",
    trap: "The next-day crossing is a quote, not a booking. The timed-out attempt may have made a booking, so it must be checked before a retry.",
    expected: "card",
    placeHints: {},
    simulatedQuotes: [
      {
        id: "sim-hotel-299",
        kind: "HOTEL",
        status: "AVAILABLE_QUOTE",
        provider: "Harbour Rest Hotel",
        from_city: "West Baltic terminal",
        to_city: "West Baltic terminal",
        departure_at: "2026-10-23T19:00:00Z",
        arrival_at: "2026-10-24T08:00:00Z",
        quote_cents: 9400,
        currency: "EUR",
        capacity_note: "Room quote near the terminal, not booked. Simulated quote.",
        simulated: true,
      },
    ],
    driver: {
      name: "Camille Emberwick",
      situation: "You have the gig for CD-420299 with pickup on 23 Oct. You have no ferry reference. The later sailing on 24 Oct works for you if a hotel night near the terminal is booked.",
      tellOnlyWhenAsked: [{ topic: "pickup", answer: "You keep the pickup time on 23 Oct 09:00 to 11:00 UTC." }],
      scriptedReplies: ["Yes, the 24 Oct 12:00 sailing works if I get a hotel near the terminal on the 23rd. I keep the pickup time as planned."],
    },
    script: [
      { thought: "Read the order, the promise and the gig.", tool: "get_order", input: { order_ref: "CD-420299" } },
      { thought: "Read the ferry options and the failed attempt.", tool: "get_travel_options", input: { order_ref: "CD-420299" } },
      { thought: "Ask the driver if the later sailing and a hotel night work.", tool: "message_driver", input: { order_ref: "CD-420299", text: "The 23 Oct overnight crossing is sold out. Does the 24 Oct 12:00 sailing work for you with one hotel night near the terminal? Your pickup time stays the same." } },
      { thought: "Check the promise with the later crossing.", tool: "estimate_arrival", input: { order_ref: "CD-420299", via_travel_option_id: "travel-xf29ed1732d895f37" } },
      {
        thought: "The later crossing still lands before the 27 Oct promise, so no date change. But it is a quote, and the timed-out attempt must be checked first.",
        final: "propose_action",
        input: {
          order_ref: "CD-420299",
          summary: "Overnight ferry sold out. Book the 24 Oct 12:00 crossing and a hotel night (€481)? Promise still holds.",
          deadline_iso: "2026-10-23T09:00:00Z",
          deadline_label: "Pickup starts 23 Oct 09:00 UTC",
          facts: [
            { label: "Planned crossing", value: "23 Oct 22:00, sold out", source: "tool", record_id: "travel-xc1d8163d5443a606" },
            { label: "24 Oct 12:00 crossing", value: "Quote €387, checked 07:00 UTC, not booked", source: "tool", record_id: "travel-xf29ed1732d895f37" },
            { label: "Earlier booking attempt", value: "Timed out with no reference. Outcome unknown.", source: "app", record_id: "agent-x4ac988b20000595f" },
            { label: "Driver", value: "Later sailing works with a hotel night", source: "driver_chat", record_id: "@last_driver_reply" },
            { label: "Delivery promise", value: "27 Oct 11:00 to 13:00 UTC", source: "order", record_id: "win-delivery" },
          ],
          agent_actions: [
            "Read the ferry options and the failed booking attempt",
            "Asked the driver about the later sailing",
            "Got a hotel quote near the terminal",
            "Calculated the arrival: the 27 Oct promise still holds",
          ],
          proposal: {
            kind: "rebook_ferry",
            description: "First ask the carrier if the timed-out attempt made a booking. If not, book the 24 Oct 12:00 crossing (€387) and one hotel night near the terminal (€94).",
            cost_delta_eur: 481,
            travel_option_id: "travel-xf29ed1732d895f37",
          },
        },
      },
    ],
  },
  {
    id: "late-399",
    orderRef: "CD-420399",
    title: "Driver cannot reach Leipzig pickup after Hamburg gig",
    at: "2026-10-21T09:24:00Z",
    kind: "late_driver",
    trigger: "Positioning risk on CD-420399: the assigned driver says they cannot reach the selected Leipzig pickup after their current gig. Check the chain and bring a person the decision.",
    trap: "The previous-duty ETA is a tracking estimate, not a location. The buyer update must not name the other customer's trip.",
    expected: "card",
    placeHints: {},
    driver: {
      name: "Freya Marvellen",
      situation:
        "You are driving CD-420326 to Hamburg. After the handover you need your rest. You can leave Hamburg at 12:00 local time tomorrow at the earliest. By train you reach Leipzig around 16:00 local.",
      tellOnlyWhenAsked: [{ topic: "later slot", answer: "You can do the Leipzig pickup tomorrow from 16:30 local if the buyer agrees." }],
      scriptedReplies: ["Confirmed: earliest departure from Hamburg is 12:00 local tomorrow. By train I reach Leipzig around 16:00. I could collect from 16:30 local if the buyer agrees."],
    },
    script: [
      { thought: "Read the Leipzig gig and the pickup slot.", tool: "get_order", input: { order_ref: "CD-420399" } },
      { thought: "Check the driver's current gig and its ETA.", tool: "get_gps", input: { order_ref: "CD-420326" } },
      { thought: "Confirm the driver constraint in their own words.", tool: "message_driver", input: { order_ref: "CD-420399", text: "Can you confirm the earliest time you can leave Hamburg tomorrow, and when you could be in Leipzig?" } },
      { thought: "Check what the chain does to the Leipzig slot.", tool: "estimate_arrival", input: { order_ref: "CD-420326" } },
      {
        thought: "The slot cannot be met by this driver. A person decides: find a replacement, or ask the buyer for a later slot.",
        final: "propose_action",
        input: {
          order_ref: "CD-420399",
          summary: "Driver cannot reach the Leipzig pickup tomorrow 09:00. Offer the gig to a replacement driver?",
          deadline_iso: "2026-10-22T09:00:00Z",
          deadline_label: "Pickup starts 22 Oct 09:00 UTC",
          facts: [
            { label: "Leipzig pickup", value: "22 Oct 09:00 to 10:00 UTC", source: "order", record_id: "win-pickup" },
            { label: "Driver earliest start", value: "Leaves Hamburg 12:00 local, Leipzig about 16:00", source: "driver_chat", record_id: "@last_driver_reply" },
            { label: "Current gig ETA", value: "Hamburg 13:24 UTC today. Tracking estimate only.", source: "gps", record_id: "track-xaffae161c6e61670" },
            { label: "Travel booked", value: "None", source: "order", record_id: "asg-x8cb23e805f9b3043" },
          ],
          agent_actions: [
            "Read the chain: Hamburg gig, then the Leipzig pickup",
            "Asked the driver to confirm the earliest start",
            "Calculated: the driver reaches Leipzig about 7 h after the slot",
          ],
          proposal: {
            kind: "repost_gig",
            description: "Offer the Leipzig pickup to nearby drivers now. Keep the current driver booked until a replacement accepts. If nobody accepts by 18:00 UTC, ask the buyer about a pickup from 16:30 local.",
            customer_draft:
              "We are reviewing the collection timing for your car in Leipzig tomorrow. We will confirm the time today. No change is agreed yet.",
          },
        },
      },
    ],
  },
  // ---------- Photo events: the photo model (Jev) looks at real packet photos and scans ----------
  {
    id: "photo-071",
    orderRef: "CD-420071",
    title: "Pickup photos rejected: another car?",
    at: "2026-10-21T09:36:00Z",
    kind: "photo_check",
    trigger: "Evidence follow-up on CD-420071: the pickup photos were rejected. Check what the photos show, gather the facts and bring a person the decision on the evidence.",
    trap: "The site confirmed the car's identity at release, but not its condition. A safe-stop photo is current condition, not pickup condition.",
    expected: "card",
    placeHints: {},
    driver: {
      name: "Selma Talverick",
      situation: "You drive the Audi Q8 e-tron on CD-420071. At pickup you first photographed the neighbouring Mercedes by mistake. You are now on the motorway, about 40 minutes from the next rest area.",
      tellOnlyWhenAsked: [{ topic: "photos", answer: "You can take the registration and four sides at the next rest area in about 40 minutes." }],
      scriptedReplies: ["Sorry, I photographed the car next to it first. I can take the registration and all four sides of the Audi at the next rest area, in about 40 minutes."],
    },
    script: [
      { thought: "Read the order and the open evidence follow-up.", tool: "get_order", input: { order_ref: "CD-420071" } },
      { thought: "See which photos exist and why they were rejected.", tool: "list_attachments", input: { order_ref: "CD-420071" } },
      { thought: "Ask the photo model what the pickup photo actually shows.", tool: "check_image", input: { attachment_id: "attachment-0629810648b51a2842a7", question_ids: ["photo_vehicle_main", "photo_matches_car", "photo_damage_visible"] } },
      { thought: "Ask the driver for new photos, labelled as current condition.", tool: "message_driver", input: { order_ref: "CD-420071", text: "Hi Selma, the pickup photos show another car. At your next safe stop, please photograph the Audi's registration and all four sides. We will file them as current condition, not pickup condition." } },
      {
        thought: "Identity is confirmed by the site, condition at pickup is not. A person decides how to file the evidence.",
        final: "propose_action",
        input: {
          order_ref: "CD-420071",
          summary: "Pickup photo shows another car. Keep pickup proof rejected and file safe-stop photos as current condition?",
          deadline_iso: "2026-10-21T10:00:00Z",
          deadline_label: "Evidence follow-up due 10:00 UTC",
          facts: [
            { label: "Pickup photo", source: "app", vision: { attachment_id: "attachment-0629810648b51a2842a7", question_id: "photo_matches_car", yes: "Shows the order car, an Audi Q8 e-tron", no: "Shows a different car, not the Audi Q8 e-tron" } },
            { label: "Photo review", value: "Rejected: two files show another registration", source: "operator", record_id: "proof-x0af29b33dadf634a" },
            { label: "Site check", value: "VIN SYNHU89YZ8GSW6CKB checked at release; no condition photos", source: "site", record_id: "msg-x9822b466078f9411" },
            { label: "Driver", value: "Can photograph the Audi at the next rest area, about 40 min", source: "driver_chat", record_id: "@last_driver_reply" },
          ],
          agent_actions: [
            "Checked the rejected pickup photo with the photo model",
            "Read the site's identity confirmation and the ops note",
            "Asked the driver for registration and four-side photos at the next safe stop",
          ],
          proposal: {
            kind: "none",
            description: "Keep the pickup photos rejected. Record the site's VIN check as identity evidence. File the driver's safe-stop photos as current condition only, and review the delivery photos separately.",
          },
        },
      },
    ],
  },
  {
    id: "photo-612",
    orderRef: "CD-420612",
    title: "Delivery photos show no car",
    at: "2026-10-21T09:52:00Z",
    kind: "photo_check",
    trigger: "Evidence check on CD-420612: the delivery photos were rejected after a delivered import. Check the photos and the CMR, and bring a person the decision on how to prove the handover.",
    trap: "A delivered status is not a proven handover. The CMR has only a collection signature.",
    expected: "card",
    placeHints: {},
    driver: {
      name: "Oscar Helvanto",
      situation: "You delivered the Volvo V60 on CD-420612 on 16 Oct. Staff moved the car into the showroom before you took photos, so you photographed the empty forecourt. A person called Mika at the front desk took the keys.",
      tellOnlyWhenAsked: [{ topic: "receiver", answer: "Mika at the front desk took the keys at about 07:00 UTC." }],
      scriptedReplies: ["Sorry, staff moved the Volvo inside before I took photos. Mika at the front desk took the keys at about 07:00 UTC. I have no photo of the car at the handover."],
    },
    script: [
      { thought: "Read the order: delivered, delivery proof rejected.", tool: "get_order", input: { order_ref: "CD-420612" } },
      { thought: "List the photos and documents.", tool: "list_attachments", input: { order_ref: "CD-420612" } },
      { thought: "What does the delivery photo show?", tool: "check_image", input: { attachment_id: "attachment-69028dd00ca2374fb4f5", question_ids: ["photo_vehicle_main", "photo_matches_car"] } },
      { thought: "Does the CMR show that the receiver signed?", tool: "check_image", input: { attachment_id: "attachment-9b428a2c8dea1706bffd", question_ids: ["doc_type", "doc_vin_matches", "doc_receiver_signed"] } },
      { thought: "Ask the driver who received the car.", tool: "message_driver", input: { order_ref: "CD-420612", text: "Hi Oscar, the delivery photos for CD-420612 show the forecourt but not the Volvo. Who received the car and the keys, and at what time?" } },
      {
        thought: "No photo and no receiver signature: the handover needs a written confirmation from the site. A person sends that request.",
        final: "propose_action",
        input: {
          order_ref: "CD-420612",
          summary: "Delivery photos show no car and the CMR has no receiver signature. Ask the site to confirm the handover?",
          deadline_iso: "2026-10-21T16:00:00Z",
          deadline_label: "Before today's invoicing run",
          facts: [
            { label: "Delivery photo", source: "app", vision: { attachment_id: "attachment-69028dd00ca2374fb4f5", question_id: "photo_vehicle_main", yes: "Shows the car", no: "Shows the forecourt, no car" } },
            { label: "CMR", source: "app", vision: { attachment_id: "attachment-9b428a2c8dea1706bffd", question_id: "doc_receiver_signed", yes: "Receiver signed", no: "Collection signed only, no receiver signature" } },
            { label: "Photo review", value: "Rejected: no delivered vehicle or handover in any file", source: "operator", record_id: "proof-x1a6c51d3a362f8e8" },
            { label: "Driver", value: "Staff moved the car inside; Mika at the desk took the keys about 07:00", source: "driver_chat", record_id: "@last_driver_reply" },
          ],
          agent_actions: [
            "Checked the delivery photo and the CMR with the photo model",
            "Asked the driver who received the car",
          ],
          proposal: {
            kind: "message_customer",
            description: "Ask the receiving site to confirm in writing who received the Volvo V60 and when. Keep the delivery photos rejected until then.",
            customer_draft: "Could you confirm in writing who received the Volvo V60 on 16 Oct and at what time? Our driver reports that Mika at the front desk took the keys at about 10:00 local time. Our delivery photos do not show the handover.",
          },
        },
      },
    ],
  },
  {
    id: "photo-055",
    orderRef: "CD-420055",
    title: "Damage claim: compare the photos",
    at: "2026-10-21T09:44:00Z",
    kind: "photo_check",
    trigger: "Condition claim on CD-420055: the receiver reports a mark on the left rear of the Bentley and sent photos. Compare the photos with the pickup evidence and bring a person the next step.",
    trap: "A claim photo shows the mark now. It does not show when it happened. One pickup photo is not the full set.",
    expected: "card",
    placeHints: {},
    driver: { name: "Oliver Karvenby", situation: "Not contacted in this event.", tellOnlyWhenAsked: [], scriptedReplies: ["OK."] },
    script: [
      { thought: "Read the claim and the earlier notes.", tool: "get_order", input: { order_ref: "CD-420055" } },
      { thought: "List the pickup photos and the claim photos.", tool: "list_attachments", input: { order_ref: "CD-420055" } },
      { thought: "What does the receiver's close-up show?", tool: "check_image", input: { attachment_id: "attachment-c31d2a11930b3f4cba04", question_ids: ["photo_damage_visible", "photo_matches_car"] } },
      { thought: "Is damage visible in the pickup photo of the same side?", tool: "check_image", input: { attachment_id: "attachment-45e0a8f3c91f35a0ff88", question_ids: ["photo_damage_visible", "photo_matches_car"] } },
      {
        thought: "The claim photo shows damage; the sampled pickup photo does not. That is a reason to review, not a finding. A person decides.",
        final: "propose_action",
        input: {
          order_ref: "CD-420055",
          summary: "Claim photo shows a scrape on the left rear; the pickup photo shows none. Open a damage review?",
          deadline_iso: "2026-10-21T12:00:00Z",
          deadline_label: "Customer waits for an answer today",
          facts: [
            { label: "Claim photo", source: "app", vision: { attachment_id: "attachment-c31d2a11930b3f4cba04", question_id: "photo_damage_visible", yes: "Scrape visible on the left rear", no: "No damage visible" } },
            { label: "Pickup photo", source: "app", vision: { attachment_id: "attachment-45e0a8f3c91f35a0ff88", question_id: "photo_damage_visible", yes: "Damage already visible at pickup", no: "No damage visible at pickup (1 of 4 photos)" } },
            { label: "Receiver", value: "Cannot confirm when they first noticed the mark", source: "order", record_id: "msg-x9eb6cf0c35899038" },
            { label: "Delivery photos", value: "Approved 16 Oct; files not in the packet", source: "order", record_id: "proof-x8012be5433be117b" },
            { label: "Ops note", value: "A claim is not a damage finding. Keep the original evidence.", source: "operator", record_id: "msg-x90de9fb231de677a" },
          ],
          agent_actions: [
            "Checked the receiver's close-up with the photo model",
            "Checked the pickup photo of the same side",
            "Read the claim thread and the ops note",
          ],
          proposal: {
            kind: "none",
            description: "Open a damage review. Pull all delivery photos of the left rear and ask the delivering driver for a statement. Do not accept or reject the claim yet.",
            customer_draft: "Thank you for the photos. The pickup photos do not show this mark. We are now reviewing the delivery photos and the driver's report and will come back to you with what we can establish.",
          },
        },
      },
    ],
  },
  {
    id: "receipt-145",
    orderRef: "CD-420145",
    title: "Fuel receipt submitted",
    at: "2026-10-21T09:08:00Z",
    kind: "receipt_check",
    trigger: "New expense on CD-420145: the driver submitted a fuel receipt. Check the receipt against the claim before it goes to the normal expense review.",
    trap: "Approving the cost is a person's decision. The agent only checks the receipt.",
    expected: "quiet",
    placeHints: {},
    driver: { name: "Kasper Carvell", situation: "Not contacted in this event.", tellOnlyWhenAsked: [], scriptedReplies: ["OK."] },
    script: [
      { thought: "Read the order.", tool: "get_order", input: { order_ref: "CD-420145" } },
      { thought: "Find the receipt.", tool: "list_attachments", input: { order_ref: "CD-420145" } },
      { thought: "Read the receipt with the photo model and compare it with the claim.", tool: "check_image", input: { attachment_id: "attachment-5297f2115e2dc8f3750a", question_ids: ["doc_type", "receipt_kind", "receipt_total_matches"] } },
      {
        thought: "The receipt result goes with the claim to the normal review. Nothing for a person here.",
        final: "close_quietly",
        input: {
          order_ref: "CD-420145",
          reason: "Fuel receipt checked against the claim of EUR 45.84 and left for the normal expense review. Nothing approved or changed.",
          reason_vision: { attachment_id: "attachment-5297f2115e2dc8f3750a", question_id: "receipt_total_matches", yes: "Total matches the claim", no: "Total does NOT match the claim" },
        },
      },
    ],
  },
];

export function scenario(id: string) {
  return SCENARIOS.find((s) => s.id === id);
}

export function scenarioForOrder(ref: string) {
  return SCENARIOS.find((s) => s.orderRef === ref);
}
