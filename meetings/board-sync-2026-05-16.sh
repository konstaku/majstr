#!/usr/bin/env bash
# Board reconciliation — Majstr Mini App Spike (project #2, owner konstaku)
# Generated 2026-05-16 from the ship-audit. Run AFTER `gh auth login -h github.com`.
# Idempotent-ish: re-closing/closed issues is tolerated via `|| true`.
set -uo pipefail

OWNER=konstaku
PROJECT=2
PROJECT_NODE_ID=PVT_kwHOAgskrs4BX3Pl
REPO=konstaku/majstr

echo ">> Verifying gh auth..."
gh auth status -h github.com || { echo "gh not authenticated — run: gh auth login -h github.com"; exit 1; }

# ── 1. Close issues that are genuinely DONE (verified in code) ────────────────
# Wizard B-series (B1-B4 committed; B5 StepContact built 2026-05-16),
# backend submit completed today, char counter done, quick wins shipped.
for n in 40 41 42 43 44 35 71; do
  echo ">> closing #$n (done)"
  gh issue close "$n" -R "$REPO" -c "Verified complete in code (ship-audit 2026-05-16)." || true
done

# ── 2. Create issues for real gaps found by the audit (fixed today) ───────────
gh issue create -R "$REPO" \
  -t "Frontend: wizard had no submit/finalize — FIXED 2026-05-16" \
  -b "Audit found OnboardingWizard dead-ended on the last step (no submit). Fixed: useDraft.submit() flushes pending edits then POSTs /api/masters/draft/submit; success screen + error popups added." \
  -l "frontend,ux-onboarding" || true

gh issue create -R "$REPO" \
  -t "Backend: no admin keyboard / owner DM for TMA cards — FIXED 2026-05-16" \
  -b "submitDraft sent a bare admin link; bot.js had no master: callback. Fixed: Approve/Decline inline keyboard + handleMasterCallback (status + audit row + owner confirmation DM). Closes the friction-#5 / #68 gap." \
  -l "backend,ux-onboarding" || true

gh issue create -R "$REPO" \
  -t "Security: NoSQL injection in patchDraft — FIXED 2026-05-16" \
  -b "String draft fields accepted objects (e.g. {\$gt:''}). Fixed: type-strict validatePatch rejects operator/dot keys and enforces the data contract." \
  -l "backend" || true

# ── 3. Create follow-up issues (open) ────────────────────────────────────────
gh issue create -R "$REPO" \
  -t "TMA: reliable phone capture via requestContact across clients" \
  -b "Manual phone entry is the always-works primary path. requestContact return shape varies by client; deep-integrate (bot-side shared-contact message) as the zero-friction path." \
  -l "frontend,ux-onboarding" || true

gh issue create -R "$REPO" \
  -t "Tooling: resolve lint --max-warnings 0 vs 5 pre-existing fast-refresh warnings" \
  -b "Lint script was dead (scanned 0 files); now fixed to scan ts/tsx. 5 pre-existing react-refresh/only-export-components + exhaustive-deps warnings in surface/ui. Split non-component exports or relax threshold." \
  -l "frontend" || true

# ── 4. Set project Status field (fetch option IDs at runtime) ────────────────
echo ">> Reconciling project board Status..."
FIELDS_JSON=$(gh project field-list "$PROJECT" --owner "$OWNER" --format json 2>/dev/null)
STATUS_FIELD_ID=$(echo "$FIELDS_JSON" | python3 -c "import json,sys;d=json.load(sys.stdin);print(next(f['id'] for f in d['fields'] if f['name']=='Status'))")
opt(){ echo "$FIELDS_JSON" | python3 -c "import json,sys;d=json.load(sys.stdin);print(next(o['id'] for f in d['fields'] if f['name']=='Status' for o in f.get('options',[]) if o['name']=='$1'))"; }
DONE_ID=$(opt Done); READY_ID=$(opt Ready); BACKLOG_ID=$(opt Backlog)

ITEMS_JSON=$(gh project item-list "$PROJECT" --owner "$OWNER" --limit 100 --format json)
set_status(){ # $1=issue number  $2=status option id
  local iid
  iid=$(echo "$ITEMS_JSON" | python3 -c "import json,sys;d=json.load(sys.stdin);print(next((it['id'] for it in d['items'] if it.get('content',{}).get('number')==$1),''))")
  [ -z "$iid" ] && { echo "  (no board item for #$1)"; return; }
  gh project item-edit --id "$iid" --project-id "$PROJECT_NODE_ID" \
    --field-id "$STATUS_FIELD_ID" --single-select-option-id "$2" >/dev/null 2>&1 && echo "  #$1 -> set" || echo "  #$1 -> edit failed (set in UI)"
}

# Done
for n in 40 41 42 43 44 45 35 63 64 65 66 67 71; do set_status "$n" "$DONE_ID"; done
# Ready / active toward ship
for n in 47 48 49 50 68 69 70 46; do set_status "$n" "$READY_ID"; done
# Backlog — claim flow + cleanup are post-onboarding
for n in 55 56 57 58 59 60 61 62 72; do set_status "$n" "$BACKLOG_ID"; done

echo ">> Board reconciliation complete."
