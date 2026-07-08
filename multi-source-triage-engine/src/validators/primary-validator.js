/**
 * validators/primary-validator.js
 *
 * Primary validator. Represents an external API call (in production, USPS DPV).
 * Returns HIGH confidence for clearly-deliverable US addresses, LOW for non-US or malformed,
 * and MEDIUM for ambiguous cases.
 *
 * This is a mock. In production, this would make an HTTP call to the USPS Address
 * Information API and interpret DPV codes.
 */

// Mock "USPS database" for demonstration.
const mockUspsResponses = {
  '123 Main St, Springfield, IL, 62701': { dpv: 'Y', standardized: '123 MAIN ST' },
  '999 Fake Ave, Nowhere, XX, 00000': { dpv: 'N', standardized: null },
  '500 Ambiguous Rd, Portland, OR, 97201': { dpv: 'S', standardized: '500 AMBIGUOUS RD' } // secondary needed
};

/**
 * DPV code interpretation:
 *   Y = deliverable (auto-approve)
 *   N = undeliverable (auto-reject)
 *   S = deliverable but missing secondary info (ambiguous, needs fallback)
 *   D = missing secondary info required
 *
 * Non-US addresses are outside USPS scope; return LOW confidence to defer to fallback.
 */

/**
 * @param {Object} item
 * @returns {Promise<ValidationResult>}
 */
async function validate(item) {
  // Non-US addresses are out of scope for this validator
  if (item.country !== 'US') {
    return {
      source: 'primary_validator_usps',
      confidence: 'LOW',
      verdict: 'AMBIGUOUS',
      evidence: {
        reason: 'non_us_address',
        note: 'USPS validation only handles US addresses; deferring to fallback'
      }
    };
  }

  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 50));

  const key = `${item.addressLine}, ${item.city}, ${item.state}, ${item.postalCode}`;
  const response = mockUspsResponses[key];

  if (!response) {
    // Unknown address (not in our mock database). In production, USPS would return
    // a specific "not found" response. Treat as ambiguous.
    return {
      source: 'primary_validator_usps',
      confidence: 'LOW',
      verdict: 'AMBIGUOUS',
      evidence: {
        reason: 'address_not_in_usps',
        note: 'Address returned no match from USPS'
      }
    };
  }

  if (response.dpv === 'Y') {
    return {
      source: 'primary_validator_usps',
      confidence: 'HIGH',
      verdict: 'DELIVERABLE',
      evidence: {
        dpvCode: 'Y',
        standardizedAddress: response.standardized,
        note: 'USPS confirms address is deliverable'
      }
    };
  }

  if (response.dpv === 'N') {
    return {
      source: 'primary_validator_usps',
      confidence: 'HIGH',
      verdict: 'UNDELIVERABLE',
      evidence: {
        dpvCode: 'N',
        note: 'USPS confirms address is not deliverable'
      }
    };
  }

  // dpv === 'S' or 'D': deliverable but missing secondary info
  return {
    source: 'primary_validator_usps',
    confidence: 'MEDIUM',
    verdict: 'AMBIGUOUS',
    evidence: {
      dpvCode: response.dpv,
      standardizedAddress: response.standardized,
      note: 'USPS returned ambiguous DPV code; may need secondary unit info'
    }
  };
}

module.exports = { validate };
