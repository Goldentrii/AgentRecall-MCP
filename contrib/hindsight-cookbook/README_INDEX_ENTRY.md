<!-- Add this entry to the cookbook's top-level README, in the applications/ section. -->

### AgentRecall Memory (`applications/agentrecall-memory/`)

Import an AI coding agent's accumulated **corrections** (mistakes + the rule that fixes them)
from [AgentRecall](https://github.com/Goldentrii/AgentRecall) (MIT, local-first) into a
Hindsight memory bank, so `recall` / `reflect` surface the corrected understanding in a fresh
session and the agent stops repeating the mistake. AgentRecall is the host-side correction
**capture + governance** source (it owns `active` / `weight` / `recurrence` / retraction);
Hindsight is the belief + recall engine. Includes a fail-closed secret scrub at the egress
boundary, a quality gate over noisy real corpora, per-project bank isolation, and a
self-contained `sample_corrections.json` fixture so the recipe runs with zero AgentRecall
install.
