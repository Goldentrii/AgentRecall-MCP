# Codex Brief — T5: Wire Embeddings Into sync-memory.py

**Role:** Implementer (Codex)
**Review by:** Claude (orchestrator)
**Task:** Modify `~/.claude/scripts/sync-memory.py` to generate OpenAI embeddings and store them in `memories.embedding` when syncing memories to Supabase.

## Context

File: `~/.claude/scripts/sync-memory.py`
- Currently: syncs local `.md` memory files to Supabase `memories` table (text fields only)
- After this task: also generates + stores 1536-dim embeddings in `memories.embedding`
- Uses `urllib.request` only (no pip installs)
- Runs as PostToolUse hook — must be fast (< 2 seconds for unchanged files, < 10 seconds for new ones)

The `memories` table now has `embedding vector(1536)` column (added by T4).

## What To Build

### 1. Add `get_embedding()` function

```python
def get_embedding(texts: list, api_key: str) -> list:
    """Generate embeddings using OpenAI text-embedding-3-small.
    Returns list of 1536-dim float arrays, one per input text.
    """
    import urllib.request, json
    
    payload = json.dumps({
        "input": texts,
        "model": "text-embedding-3-small"
    }).encode()
    
    req = urllib.request.Request(
        "https://api.openai.com/v1/embeddings",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        return [item["embedding"] for item in data["data"]]
    except Exception as e:
        print(f"[supabase-sync] embedding failed: {e}", file=sys.stderr)
        return [None] * len(texts)
```

### 2. Add embedding logic to upsert flow

Before upserting a memory to Supabase, check:
```python
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

if OPENAI_API_KEY:
    text_for_embedding = f"{name}\n{description or ''}\n{body or ''}"[:8000]
    embeddings = get_embedding([text_for_embedding], OPENAI_API_KEY)
    embedding = embeddings[0] if embeddings else None
    if embedding:
        upsert_payload["embedding"] = embedding
```

### 3. Skip re-embedding if content unchanged

The sync script already computes a hash of the file content. If the hash matches what's already in Supabase, skip the embedding API call:

```python
# If hash matches existing row AND embedding is already populated → skip embedding
if existing_hash == new_hash and existing_embedding_not_null:
    # No need to re-embed
    upsert_payload.pop("embedding", None)
```

Read the current sync-memory.py to understand the hash field name and where the existing-row check happens.

### 4. Graceful degradation

If `OPENAI_API_KEY` is not set:
- Skip embedding generation entirely
- Still sync all text fields normally
- Log: `[supabase-sync] OPENAI_API_KEY not set — syncing without embeddings`

## Files To Modify

- `~/.claude/scripts/sync-memory.py`

Read the FULL file before modifying. Understand the existing upsert flow.

## Testing

**Test 1: With OPENAI_API_KEY set**
```bash
OPENAI_API_KEY=<your-key> python3 ~/.claude/scripts/sync-memory.py
```
Expected: At least 1 row in Supabase `memories` has non-null `embedding` after run.

Verify with SQL:
```sql
SELECT COUNT(*) FROM memories WHERE embedding IS NOT NULL;
```

**Test 2: Without OPENAI_API_KEY**
```bash
python3 ~/.claude/scripts/sync-memory.py
```
Expected: Script runs normally, no crash, log shows "syncing without embeddings"

**Test 3: Unchanged file skip**
Run twice in a row with OPENAI_API_KEY. The second run should make 0 embedding API calls (all hashes match).

## Success Criteria

- `memories.embedding` column has non-null values for at least 50% of rows after a full run
- Script runs without crash when `OPENAI_API_KEY` is not set
- Unchanged files do not trigger new embedding API calls
- Script completes in < 10 seconds for unchanged files

## Do NOT

- Install pip packages — use only stdlib + what's already imported in the script
- Modify any AgentRecall source files
- Run npm commands
- Modify settings.json or any hook configuration
- Change the Supabase URL or API key in the script (read them from env or keep as-is)
