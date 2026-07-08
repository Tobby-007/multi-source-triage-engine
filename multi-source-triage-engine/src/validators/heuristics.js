/**
 * validators/heuristics.js
 *
 * Fast-path validator. Runs against local data only (no external API call).
 * Returns high confidence for items that match known-good patterns; otherwise defers.
 *
 * Example use case: an address that a customer has shipped to successfully many times
 * before is highly likely to still be deliverable. No need to hit USPS.
 */

// Mock "known good" database. In production this would be a query against a customer
// order history table or a cached repeat-customer signal.
const knownGoodCustomerAddresses = new Set([
  'customer-001|123 Repeat Street, Springfield, IL, 62701',
  'customer-002|456 Loyal Ave, Portland, OR, 97201'
]);

const knownFreightForwarderAddresses = new Set([
  '789 Freight Way, Miami, FL, 33101',
  '100 Shipping Lane, Wilmington, DE, 19801'
]);

/**
 * @typedef {Object} ValidationResult
 * @property {string} source - which validator produced this result
 * @property {'HIGH'|'MEDIUM'|'LOW'} confidence - how confident the validator is
 * @property {'DELIVERABLE'|'UNDELIVERABLE'|'AMBIGUOUS'|'SUSPICIOUS'} verdict
 * @property {Object} evidence - source-specific evidence for audit trail
 */

/**
 * @param {Object} item
 * @param {string} item.customerId
 * @param {string} item.addressLine
 * @param {string} item.city
 * @param {string} item.state
 * @param {string} item.postalCode
 * @param {string} item.country
 * @returns {ValidationResult}
 */
function validate(item) {
  const addressKey = `${item.customerId}|${item.addressLine}, ${item.city}, ${item.state}, ${item.postalCode}`;
  const forwarderKey = `${item.addressLine}, ${item.city}, ${item.state}, ${item.postalCode}`;

  // Fast-path: known good customer + known good address
  if (knownGoodCustomerAddresses.has(addressKey)) {
    return {
      source: 'heuristics',
      confidence: 'HIGH',
      verdict: 'DELIVERABLE',
      evidence: {
        rule: 'known_good_customer_address',
        note: 'Customer has previously shipped successfully to this exact address'
      }
    };
  }

  // Suspicious pattern: freight forwarder address
  if (knownFreightForwarderAddresses.has(forwarderKey)) {
    return {
      source: 'heuristics',
      confidence: 'HIGH',
      verdict: 'SUSPICIOUS',
      evidence: {
        rule: 'known_freight_forwarder',
        note: 'Address matches a known freight-forwarder location'
      }
    };
  }

  // No fast-path match. Return LOW confidence so the engine falls through to the next validator.
  return {
    source: 'heuristics',
    confidence: 'LOW',
    verdict: 'AMBIGUOUS',
    evidence: {
      rule: 'no_heuristic_match',
      note: 'No fast-path rules matched; deferring to primary validator'
    }
  };
}

module.exports = { validate };
