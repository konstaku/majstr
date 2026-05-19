# ADR 0001 — Telegram chat access strategy

- Status: Accepted
- Date: 2026-05-19
- Tracking: konstaku/majstr#81 · Board: GitHub Project #4

## Context

The master-mining initiative needs to read public Telegram community-chat
content in two modes:

- **Research mode** — one-shot deep backfill of < 1 year of history for a chat.
- **Watcher mode** — ongoing ingestion of new messages.

The existing bot uses the Telegram **Bot API** (`node-telegram-bot-api`). The
Bot API physically cannot fetch historical messages and only receives messages
in chats the bot has been added to, going forward. Reading arbitrary public
history requires the **MTProto client API** via a user account (e.g. GramJS) —
which is automation on a user account and is against Telegram's Terms of
Service, carrying an account/number ban risk.

## Decision

- **Research / history backfill = manual Telegram Desktop JSON export.**
  The operator exports the chat (`result.json`) from Telegram Desktop and the
  pipeline ingests that file. No MTProto, no automation, **no ToS/ban risk**
  for the bulk-history phase.
- **Watcher mode = GramJS on a dedicated, separate Telegram account.**
  Live monitoring of the single pilot chat only. This is the only component
  that carries ToS/ban risk, and it is deliberately isolated to M6.

Rejected alternatives:

- *MTProto for the bulk backfill* — full automation convenience, but exposes a
  user account to ban risk across a high-volume scrape. Rejected: the manual
  export removes the risk entirely for the same data.
- *Bot API only* — zero risk but cannot backfill history at all and only sees
  chats the bot is added to. Rejected: kills research mode.

## Consequences

- Research mode has a manual human step per chat (acceptable at pilot scale —
  one chat: Italy/Veneto).
- The watcher (M6) is **risk-gated**. Before M6 starts:
  - A **dedicated separate account** is used — never a personal or admin
    account. (Provisioned; konstaku/majstr#103.)
  - Read-only usage, **single pilot chat scope only**.
  - A **kill-switch** env flag must be able to stop the watcher immediately.
  - The session string is stored encrypted and never committed.
- Both modes feed the **same** pre-filter + classifier pipeline, so the access
  mechanism is an ingestion detail invisible to classification and review.
- ToS/ban risk for the watcher is explicitly **accepted** by the project owner
  as scoped above; if the account is banned, research-mode export remains a
  fully functional fallback for keeping data fresh.
