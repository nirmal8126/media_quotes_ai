# Content Integrity System

This project ships a cross-module integrity layer that scores originality and safety for reels, videos, quotes, scripts, and captions.

## Schema
- `content_integrity_reports` — content_id, content_type, platform, status, score, issues, fixes.
- `content_versions` — store variants/versions per content item.
- Optional `integrity_report_id` columns on reels/scripts/quotes (nullable).

SQL snippets live in:
- `web/docs/sql/content_integrity.sql` (cross-module)
- `web/docs/sql/ai_reels_tables.sql` (reels tables + enums)
- Runnable Supabase migration: `web/supabase/migrations/2024032301_content_integrity.sql` (idempotent).

To apply with Supabase CLI:
```bash
cd web
supabase db push
# or
psql "$SUPABASE_DB_URL" -f supabase/migrations/2024032301_content_integrity.sql
```

## Types
Defined in `web/src/lib/integrity/types.ts`:
- `ContentUnit` abstraction (type, platform, textContent, mediaAssets, audio, metadata, versions, previousTexts, generatedCount).
- `IntegrityReport` with `status | score | issues | fixes`.

## Engine
`web/src/lib/integrity/IntegrityEngine.ts`
- Rules (MVP):
  - Warn: trending audio
  - Risk: unknown media source
  - Warn: high similarity vs previous texts (Jaccard shingles)
- Warn: generated multiple times
- Warn: no human edits detected (`metadata.userEdited !== true`)
- Returns report with status/score/issues/fixes.

Similarity util: `web/src/lib/integrity/similarity.ts` (+ self-test).

## API
- `GET /api/content/:type/:id/integrity` — latest report (best-effort if table missing).
- `POST /api/content/:type/:id/integrity` — recompute and persist (saves to Supabase + links integrity_report_id where supported).
- `POST /api/content/:type/:id/fix` — records a content_version entry, recomputes, and persists a new report.

Auth uses Supabase server helpers. Persistence is best-effort; errors from missing tables are swallowed.

## Extending Rules
- Add new rule functions in `IntegrityEngine.ts` and include in the rule list.
- Replace the similarity function with embeddings when ready.
- Add watermark checks by enriching `mediaAssets[].metadata` and scoring in the engine.
- Platform-specific rules: check `unit.platform` to enforce per-platform heuristics.

## Human-in-loop tracking
- Pass `metadata.userEdited = true` when the user modifies text/scene/captions. The engine warns if not set.

## Tests
- Minimal assertions live in `web/src/lib/integrity/__tests__/similarity.test.ts` (console-based; run with a TS/JS test runner or manually).
