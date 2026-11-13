-- Local question history only; this table is never an input to training decisions.
CREATE TABLE IF NOT EXISTS question_log (
  id INTEGER PRIMARY KEY,
  asked_at INTEGER NOT NULL CHECK (asked_at > 0),
  question_text TEXT NOT NULL CHECK (length(trim(question_text)) BETWEEN 1 AND 300),
  outcome_kind TEXT NOT NULL CHECK (outcome_kind IN ('card', 'none', 'refer')),
  glossary_term_id TEXT,
  CHECK ((outcome_kind = 'card' AND glossary_term_id IS NOT NULL AND length(glossary_term_id) > 0)
    OR (outcome_kind IN ('none', 'refer') AND glossary_term_id IS NULL))
) STRICT;
