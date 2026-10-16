# Shift 4.0 — Product one-pager

> A human-in-the-loop AI decision system for warehouse operations, delivered as a
> playable simulation.

The simulation is the product surface, not the point. What Shift 4.0 demonstrates
is how a fast decision model is embedded into an operation: what it decides, how
much it is trusted, where humans stay in control, and what it costs — measured,
not claimed.

## Problem

Teams adopting AI for operational decisions face the same questions:

- **What should be automated**, and what still needs human judgement?
- **When should a model's decision be trusted** — and what happens when it is wrong
  or unavailable?
- **What does it really cost** in latency, money and quality, compared with the way
  the work is done today?

Most AI demos answer none of these. They show a chat box, or a machine replacing
people. Few show the _operating model_: decisions with confidence scores, humans in
the loop, fallbacks, and honest before/after numbers.

## Product

The player runs one shift of a distribution center as its **director, watching
from a mezzanine control room**. Trucks unload on one side, orders leave on the
other, and operators move stock in between.

Over the shift the player hires people, brings in an **AI Analyst** who makes
automation possible, and buys **robots driven by Jev**, a fast decision model.
Live panels show both sides of the operation at once: how the floor is performing,
and how the AI system is behaving.

**The core tension is _how much to automate_.** The rules make sure neither extreme
wins:

| Strategy       | Outcome                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Humans only    | Reliable but slow — trucks wait and orders miss deadlines at peak.                                                                            |
| Robots maxed   | Fast on volume, but robots cannot handle fragile items or exceptions, need recharging, and each group of robots requires a costly AI Analyst. |
| **Mixed team** | Robots take volume, humans take judgement, the model routes work between them. **This is where the best scores are.**                         |

The message — _AI works alongside people, not instead of them_ — is enforced by the
mechanics, not stated in a closing paragraph.

## Audience

| Audience                                               | Time they give | What they need                                                                               |
| ------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------- |
| Reviewers — hiring managers, engineers, product people | ~2 minutes     | Reach the "AI switches on and the numbers move" moment fast, then find the system behind it. |
| Players — developers and the curious                   | 20–30 minutes  | A short campaign with a clear goal, progression and a ranking worth returning to.            |

## How it works

**A campaign of short levels.** Each level is one figurative shift (06:00–14:00) of
about 3–4 real minutes, with speed controls (1×, 2×, 4×) and pause. The MVP ships a
working week — Monday to Friday — each day adding one complication: fragile cargo,
exceptions and damage, a VIP peak, robots running low on battery and a tighter
budget. Levels are data files on a fixed seed, so everyone plays the same day.

**Monday teaches the whole idea in one shift.** The player starts with two
operators, earns enough to hire an AI Analyst, buys a first robot, and watches it
absorb the mid-morning peak. A player who buys nothing still earns one star; one
who follows the guidance can reach three.

**Wallet and score are separate.** The wallet pays for salaries and purchases; the
score counts only how the operation served its orders, in real time — points when an
order ships, a deduction the moment one goes overdue. Investing in automation never
lowers the score.

**Stamina on both sides.** Operators get tired over the shift; robots drain their
battery and must recharge. Deciding who works and who rests is part of the job.

## Where the AI acts

Every box and order arrives with messy, human-written text — a manifest line, a
delivery note. Jev turns it into a **typed decision with a confidence score**:
category, fragility, priority, exception, and whether a robot or a human should
handle it. It also moderates public nicknames.

- **Humans in the loop:** below a confidence threshold the player controls, work is
  routed to a person.
- **Failure never breaks a shift:** every decision point has a deterministic
  fallback, and the game runs end to end without an API key.
- **Measured, not claimed:** scenario data carries the true labels, so every
  decision is scored. The same data powers an evaluation of rules versus Jev on
  accuracy, latency and cost.
- **Bounded spend:** decisions are cached per item, and per-match caps, rate limits
  and a daily ceiling protect the public demo.

## Experience principles

1. **Play first, sign in later.** No login wall: progress is saved to an anonymous
   session and can be linked to Google or GitHub to keep it and join the ranking.
2. **The "aha" within two minutes.** Level 1 is built around the moment automation
   switches on.
3. **Numbers alive, never cluttered.** At most four or five figures per panel; colour
   only when something changes state; panels can be collapsed.
4. **Honest comparisons.** "With versus without automation" replays the same day
   against a reasonable baseline, never a straw man.
5. **One source of truth for metrics.** In-game panels, the end-of-shift report and
   the public `/ops` console read the same data.

## Success metrics

Initial targets are hypotheses, to be revisited once real data exists.

| Area    | Metric                                                 | Target                    |
| ------- | ------------------------------------------------------ | ------------------------- |
| Product | Visitors who reach the first robot purchase in level 1 | ≥ 60%                     |
| Product | Visitors who finish level 1                            | ≥ 40%                     |
| Product | Players who link an account after level 1              | ≥ 15%                     |
| System  | Decision latency (p95, end to end)                     | < 600ms                   |
| System  | Model spend per completed shift                        | < $0.01                   |
| System  | Shifts completed without user-visible errors           | ≥ 99%                     |
| Quality | Jev accuracy versus the rules baseline on the eval set | Published, whatever it is |

Product events are collected first-party, without third-party trackers or personal
data.

## Non-goals

- Showcasing game development. The game is the interface, not the subject.
- Multiplayer, chat, or user-generated levels.
- Username and password accounts.
- Mechanical failures and workplace accidents (possible later).
- Free-form text generation by the model — decisions only.
- Real warehouse or customer data. All scenarios are synthetic.

## Risks

| Risk                                         | Mitigation                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Read as "just a game"                        | Framing in the README, live system panels, the `/ops` console, published evaluation numbers. |
| Scope growth                                 | Staged roadmap with a launch cut line; levels are data, not hand-built content.              |
| Dependency on an early-access model provider | Provider interface, rules fallback, and the game fully playable without a key.               |
| Public demo abuse and spend                  | Per-item cache, per-match caps, rate limits, daily ceiling, server-computed scores.          |
| Balancing takes longer than planned          | Balance targets encoded as automated tests per level.                                        |

## Open questions

- Exact economy values (salaries, prices, rewards) — settled during Stage 1 and 2
  balancing.
- Hosting for the decision worker — decided in Stage 3.
