/**
 * validators/fallback-validator.js
 *
 * Fallback validator. Represents a second external API call (in production, Google Maps
 * Geocoding). Used when the primary validator is unavailable, returns low confidence, or is
 * out of scope (non-US address).
 *
 * Interprets location_type-style responses:
 *   ROOFTOP = high confidence (deliverable)
 *   RANGE_INTERPOLATED = medium confidence
 *   GEOMETRIC_CENTER = low confidence
 *   APPROXIMATE = low confidence (city or postal-code level only)
 *
 * This is a mock. In production, this would call the Google Maps Geocoding API.
 */

const mockGoogleMapsResponses = {
  '500 Ambiguous Rd, Portland, OR, 97201, US': {
    location_type: 'ROOFTOP',
    formatted_address: '500 Ambiguous Rd, Portland, OR 97201, USA',
    postal_code_match: true,
    country_match: true
  },
  '12 Rue de la Paix, Paris, 75002, FR': {
    location_type: 'ROOFTOP',
    formatted_address: '12 Rue de la Paix, 75002 Paris, France',
    postal_code_match: true,
    country_match: true
  },
  '42 Unknown Ln, Nowhereville, 00000, ZZ': null // returns nothing
};

/**
 * @param {Object} item
 * @returns {Promise<ValidationResult>}
 */
async function validate(item) {
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 80));

  const key = `${item.addressLine}, ${item.city}, ${item.state || item.region || ''}, ${item.postalCode}, ${item.country}`.replace(', ,', ',');
  const response = mockGoogleMapsResponses[key];

  if (!response) {
    return {
      source: 'fallback_validator_google_maps',
      confidence: 'LOW',
      verdict: 'AMBIGUOUS',
      evidence: {
        reason: 'no_geocode_result',
        note: 'Google Maps returned no result for this address'
      }
    };
  }

  // High confidence only when location is precise AND postal code and country match.
  if (response.location_type === 'ROOFTOP' && response.postal_code_match && response.country_match) {
    return {
      source: 'fallback_validator_google_maps',
      confidence: 'HIGH',
      verdict: 'DELIVERABLE',
      evidence: {
        locationType: response.location_type,
        formattedAddress: response.formatted_address,
        note: 'Google Maps geocoded to rooftop-precision with matching postal code and country'
      }
    };
  }

  if (response.location_type === 'RANGE_INTERPOLATED') {
    return {
      source: 'fallback_validator_google_maps',
      confidence: 'MEDIUM',
      verdict: 'AMBIGUOUS',
      evidence: {
        locationType: response.location_type,
        formattedAddress: response.formatted_address,
        note: 'Google Maps interpolated location; not precise enough for high confidence'
      }
    };
  }

  return {
    source: 'fallback_validator_google_maps',
    confidence: 'LOW',
    verdict: 'AMBIGUOUS',
    evidence: {
      locationType: response.location_type,
      formattedAddress: response.formatted_address,
      note: 'Google Maps returned imprecise location'
    }
  };
}

module.exports = { validate };
