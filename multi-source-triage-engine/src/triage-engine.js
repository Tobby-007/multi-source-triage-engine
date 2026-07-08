/**
 * triage-engine.js
 *
 * Orchestrates decision routing across heuristics, primary validator, and fallback validator.
 * Returns a Decision object with full audit trail.
 *
 * Design principles:
 *   - Cost-ordered: cheapest check first, most expensive last
 *   - Stop-at-confident: if any stage returns HIGH confidence, do not run subsequent stages
 *   - Human escalation is a legitimate outcome, not a failure
 *   - Every decision captures the full evidence chain
 */

const heuristics = require('./validators/heuristics');
const primaryValidator = require('./validators/primary-validator');
const fallbackValidator = require('./validators/fallback-validator');

/**
 * @typedef {Object} Decision
 * @property {'DELIVERABLE'|'UNDELIVERABLE'|'HUMAN_REVIEW'|'SUSPICIOUS'} outcome
 * @property {string} resolvedBy - which stage produced the final decision
 * @property {'HIGH'|'MEDIUM'|'LOW'} confidence
 * @property {Array<Object>} evidenceChain - full audit trail
 * @property {string} [escalationReason] - populated when outcome is HUMAN_REVIEW
 */

class TriageEngine {
  constructor(config = {}) {
    // Default confidence policy. These can be overridden per-deployment based on business risk.
    this.primaryHighConfidenceThreshold = config.primaryHighConfidenceThreshold || 'HIGH';
    this.fallbackHighConfidenceThreshold = config.fallbackHighConfidenceThreshold || 'HIGH';
  }

  /**
   * Run the full triage pipeline against a single item.
   *
   * @param {Object} item
   * @returns {Promise<Decision>}
   */
  async triage(item) {
    const evidenceChain = [];

    // Stage 1: heuristics (in-memory, no API call)
    const heuristicResult = heuristics.validate(item);
    evidenceChain.push(heuristicResult);

    if (heuristicResult.confidence === 'HIGH') {
      // Heuristics resolved it. Stop here.
      return this._buildDecision({
        outcome: this._verdictToOutcome(heuristicResult.verdict),
        resolvedBy: heuristicResult.source,
        confidence: heuristicResult.confidence,
        evidenceChain
      });
    }

    // Stage 2: primary validator (external API)
    const primaryResult = await primaryValidator.validate(item);
    evidenceChain.push(primaryResult);

    if (primaryResult.confidence === 'HIGH') {
      return this._buildDecision({
        outcome: this._verdictToOutcome(primaryResult.verdict),
        resolvedBy: primaryResult.source,
        confidence: primaryResult.confidence,
        evidenceChain
      });
    }

    // Stage 3: fallback validator (second external API)
    const fallbackResult = await fallbackValidator.validate(item);
    evidenceChain.push(fallbackResult);

    if (fallbackResult.confidence === 'HIGH') {
      return this._buildDecision({
        outcome: this._verdictToOutcome(fallbackResult.verdict),
        resolvedBy: fallbackResult.source,
        confidence: fallbackResult.confidence,
        evidenceChain
      });
    }

    // Stage 4: no stage was confident. Escalate to human review.
    return this._buildDecision({
      outcome: 'HUMAN_REVIEW',
      resolvedBy: 'escalation',
      confidence: 'LOW',
      evidenceChain,
      escalationReason: 'No validator returned HIGH confidence; requires manual review'
    });
  }

  /**
   * Map a validator verdict to a final outcome.
   * @private
   */
  _verdictToOutcome(verdict) {
    switch (verdict) {
      case 'DELIVERABLE': return 'DELIVERABLE';
      case 'UNDELIVERABLE': return 'UNDELIVERABLE';
      case 'SUSPICIOUS': return 'SUSPICIOUS';
      default: return 'HUMAN_REVIEW';
    }
  }

  /**
   * @private
   */
  _buildDecision(fields) {
    return {
      outcome: fields.outcome,
      resolvedBy: fields.resolvedBy,
      confidence: fields.confidence,
      evidenceChain: fields.evidenceChain,
      escalationReason: fields.escalationReason || null,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { TriageEngine };
