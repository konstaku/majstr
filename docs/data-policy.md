# Data-handling policy — scraped master contacts

- Status: Accepted (pragmatic v1)
- Date: 2026-05-19
- Tracking: konstaku/majstr#82

Mining public Telegram chats for tradespeople involves processing personal
data (names, phone numbers, handles). This policy is the v1 safeguard set; it
gates Master-card creation (M4) and launch (M8).

## Lawful basis

**Legitimate interest.** The content being indexed was *already posted
publicly* by people offering or recommending services in open community chats.
The processing connects the Ukrainian diaspora in Italy with those service
providers — the same purpose for which the message was originally posted. A
one-page Legitimate Interest Assessment is maintained alongside this doc.

## Data minimization

- Store only **extracted fields** (name as given, profession, city, contact)
  plus a **short redacted snippet** of the source message for admin context.
- **Author identity:** a salted hash (`fromHash`, for same-author clustering)
  plus the Telegram **display name** (`fromName`, to fill a card's Name field).
  The raw numeric author id and `@username` are **never** persisted.
- **Purge the raw export** after classification completes.
- **Purge declined candidates after 30 days.**

## Transparency & control

- Scraped Master cards publish as **"community-sourced · unverified"**, with
  `source: 'scraped'`, `status: 'pending'`, `claimable: true`.
- Every scraped card carries a visible **"this is me / remove this"** action:
  - *remove* → immediate takedown (hard delete of the card + linked candidate),
  - *claim* → routes into the existing claim flow for verified ownership.
- A short public page explains where this data comes from and how to opt out.

## Scope guard

- Only outward **service offers** and **recommendations** are eligible.
- Skip anything resembling a private dispute, complaint, or personal/sensitive
  content. No special-category data is processed.

## Primary safeguard

**Admin review before publish** (the v1 human-in-the-loop design). Nothing
becomes a public card without an explicit admin accept. Autonomy is a separate,
precision-gated future phase and is out of scope for this policy version.

## Poster identity (decided 2026-05-19, amended 2026-05-21)

We persist the Telegram **display name** (`fromName`) and a salted hash
(`fromHash`) of each author — **not** the numeric author id or `@username`.

Rationale for the amendment: replies where the responder offers their own
service ("я можу допомогти", "я майстер") are valid leads, and a master card
requires a Name. The display name fills that field. It is a value that was
already posted publicly in the chat.

The card **contact** is still **not** auto-derived from a Telegram account.
When no contact appears in the message text, the review dashboard links to the
original message (`t.me/c/<chat>/<messageID>`) and the admin fetches/confirms
the real contact manually before the card goes live.

Display names follow the same retention as the rest of `RawMessage` and are
purged with declined candidates / the raw export per the rules above.
