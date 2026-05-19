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
- **Author identity is stored only as a salted hash** (`fromHash` on
  `RawMessage`) — raw Telegram author IDs are never persisted.
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
