# multi-source-triage-engine

A Node.js demonstration of the primary-fallback-heuristics decision routing pattern used in production address validation.

## Why This Pattern Exists

When you have a flagged item (an address, a fraud signal, a support ticket) that needs to be classified into an action bucket (auto-approve, escalate, auto-reject), the naive approach is to check one authoritative source. But real production systems face three constraints:

1. **The primary source is not always available** (downtime, rate limits, unexpected responses)
2. **The primary source is not always confident** (ambiguous results need a second opinion)
3. **The primary source is not always necessary** (some cases can be resolved without any external call at all)

The multi-source triage pattern handles all three by running checks in order of increasing cost:

1. **Fast-path heuristics** (cheap, uses local data only)
2. **Primary validation** (external API call, high confidence)
3. **Fallback validation** (external API call, used when primary is ambiguous or unavailable)
4. **Human escalation** (used only when all automated paths return low confidence)

## What This Repo Demonstrates

- A `TriageEngine` that orchestrates decision routing across three validators
- Three mock validators (fast-path heuristics, primary, fallback) with configurable response patterns
- A decision object that captures the full audit trail: which source made the call, what confidence level, what evidence
- Human-escalation output for genuinely ambiguous cases

## Files

- `src/triage-engine.js`: the reusable orchestrator
- `src/validators/heuristics.js`: fast-path validator (in-memory, no API)
- `src/validators/primary-validator.js`: primary validator (mock external API)
- `src/validators/fallback-validator.js`: fallback validator (mock external API)
- `src/example-usage.js`: runs the engine against a batch of mock items
- `package.json`: dependencies

## Running Locally

```bash
npm install
node src/example-usage.js
```

Expected output shows the engine processing 5 items:

1. A known-good customer address → resolved by heuristics, no API calls
2. A standard US address → resolved by primary validator
3. An ambiguous address → primary returns low confidence, fallback resolves it
4. A non-US address → primary skipped, fallback used
5. A genuinely bad address → all validators return low confidence, escalated to human

## Design Notes

**Cost-ordered validation.**
Heuristics run first because they are cheap. The primary API runs second because it is higher quality but costs an API call. The fallback runs third only when needed. Escalation runs last because it costs human time.

**Every decision has an audit trail.**
The engine returns a `Decision` object with the resolving source, confidence level, evidence, and (if escalated) reasoning. This is the artifact when something needs to be debugged.

**Validators are independent.**
Each validator implements the same interface (`validate(item) -> ValidationResult`). Adding a new source (say, a third-party fraud service) means writing a new validator, not modifying the engine.

**Confidence thresholds are configurable, not hardcoded.**
The engine takes a config object with `primaryConfidenceThreshold` and `fallbackConfidenceThreshold`. Business policy on "how confident is confident enough to act" lives in configuration, not in code.

**Human escalation is not a failure mode.**
When all validators return low confidence, the engine returns a `HUMAN_REVIEW` decision with the full context. This is a working outcome, not an error. The calling code routes it to a Slack channel, an email, or a ticket queue.

## Adapting for Production

To use this pattern with real production data:

1. Replace the mock validators with real API clients (USPS for address validation, Anthropic for AI scoring, etc.)
2. Add persistent audit logging (in production I write to Google Sheets; alternatives are DynamoDB, Postgres, or S3)
3. Add rate limit handling per validator (each external source has its own limits)
4. Add circuit breakers so a failing primary source does not slow every request while waiting for a timeout
5. Add metrics on decision distribution (what percentage resolves at each stage) so you know when to adjust thresholds

## License

MIT
