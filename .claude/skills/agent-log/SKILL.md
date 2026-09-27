---
name: agent-log
description: Appends an honest, dated entry to AGENT_LOG.md in the PolicyQuote repo. Use after every significant agent interaction here, such as generating or rewriting code, creating a skill, changing the KB, a design decision, or a rejected or corrected agent output. Also use when the user says "log this", and as the last step of the risk-engine, lambda-handler, angular-signals-component, kb-driven-tests and kb-factor skills.
---

# Agent log

`AGENT_LOG.md` at the repo root is a graded deliverable (Agent workflow 20, Demo 10). The panel reads it to see how the agent was steered, so it must be chronological, specific and honest, including the outputs that were wrong.

## Steps

1. Stamp a new entry. The script numbers it, dates it and creates the log if it is missing:
   ```bash
   bash .claude/skills/agent-log/scripts/new_entry.sh "Short title"
   ```
2. Replace every `TODO` in the new entry with the Edit tool. Keep each field to one to three lines.
3. Confirm `grep -n TODO AGENT_LOG.md` returns nothing.

## Field rules

- **Prompt**: the user's words verbatim. If it is a paraphrase, say so.
- **Output**: what the agent produced, not what it intended to produce.
- **What changed**: file paths. If nothing changed, write "nothing" and say why.
- **Why**: the reason the output was kept, tied to a rubric line or `PLAN.md` decision where one applies.
- **Rejected / corrected**: the most valuable field. Name the concrete thing thrown out (a `switch` over operators, a multiplier constant in code, `BehaviorSubject`, `any` on the event, an unsuitable third-party skill) and why. Write "Nothing rejected" only after checking the output against `CLAUDE.md`.

## Rules

- Write the entry in the same turn as the work. Never backfill, and never rewrite an earlier entry. Add a correction as a new entry that refers to the old number.
- One entry per significant prompt. Group trivial follow-ups into the entry they belong to.
- Don't embellish. If a step was skipped or a test failed, the entry says so.
