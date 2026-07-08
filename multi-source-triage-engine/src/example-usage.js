/**
 * example-usage.js
 *
 * Runs the TriageEngine against a batch of 5 mock items that demonstrate
 * each possible resolution path:
 *
 *   1. Repeat-customer address → resolved by heuristics
 *   2. Standard US address → resolved by primary validator
 *   3. Ambiguous US address → primary returns MEDIUM, fallback resolves
 *   4. Non-US address → primary skipped (LOW), fallback resolves
 *   5. Genuinely unknown address → all validators LOW, escalates to human review
 */

const { TriageEngine } = require('./triage-engine');

const engine = new TriageEngine();

const items = [
  {
    id: 'order-1001',
    customerId: 'customer-001',
    addressLine: '123 Repeat Street',
    city: 'Springfield',
    state: 'IL',
    postalCode: '62701',
    country: 'US'
  },
  {
    id: 'order-1002',
    customerId: 'customer-999',
    addressLine: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    postalCode: '62701',
    country: 'US'
  },
  {
    id: 'order-1003',
    customerId: 'customer-888',
    addressLine: '500 Ambiguous Rd',
    city: 'Portland',
    state: 'OR',
    postalCode: '97201',
    country: 'US'
  },
  {
    id: 'order-1004',
    customerId: 'customer-777',
    addressLine: '12 Rue de la Paix',
    city: 'Paris',
    region: '',
    state: '',
    postalCode: '75002',
    country: 'FR'
  },
  {
    id: 'order-1005',
    customerId: 'customer-666',
    addressLine: '42 Unknown Ln',
    city: 'Nowhereville',
    state: '',
    postalCode: '00000',
    country: 'ZZ'
  }
];

async function main() {
  console.log(`\nRunning triage engine on ${items.length} items...\n`);

  for (const item of items) {
    const decision = await engine.triage(item);
    console.log(`--- ${item.id} ---`);
    console.log(`  Outcome:     ${decision.outcome}`);
    console.log(`  Resolved by: ${decision.resolvedBy}`);
    console.log(`  Confidence:  ${decision.confidence}`);
    console.log(`  Stages run:  ${decision.evidenceChain.length}`);
    if (decision.escalationReason) {
      console.log(`  Escalation:  ${decision.escalationReason}`);
    }
    console.log(`  Evidence chain:`);
    decision.evidenceChain.forEach((ev, i) => {
      console.log(`    [${i + 1}] ${ev.source} → ${ev.confidence} confidence, ${ev.verdict}`);
    });
    console.log('');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
