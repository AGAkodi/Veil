// veil.aleo — private institutional payment rails.
//
// Two surfaces:
//   private_transfer  — move value between parties without publishing amount,
//                       sender, or recipient
//   prove_compliance  — prove a counterparty is absent from a sanctions list
//                       without publishing which counterparty was screened

program veil.aleo {

    // Deployment is final. Payment rails whose logic can be swapped out later
    // are not payment rails an institution can underwrite.
    @noupgrade
    constructor() {}

    // A private balance held by `owner`. Aleo encrypts the record to the
    // owner's view key, so no field here is publicly readable.
    //
    // There is deliberately no `recipient` field. The recipient of a transfer
    // *is* the owner of the record it produces; storing it separately would be
    // redundant and would add a correlation handle for no benefit.
    record PaymentRecord {
        owner: address,
        amount: u64,
        sender: address,
        memo: field,
    }

    // Bootstrap a spendable record so testnet has something to move.
    // Demo scaffolding — real value would be bridged in from credits.aleo.
    fn issue(recipient: address, amount: u64, memo: field) -> PaymentRecord {
        return PaymentRecord {
            owner: recipient,
            amount: amount,
            sender: std::ctx::caller(),
            memo: memo,
        };
    }

    // Consume the caller's record; emit the recipient's record and the change.
    //
    // Exact-amount transfers produce a zero-value change record. That is
    // intentional: suppressing it would make the output count depend on the
    // amount, which leaks whether the sender drained the record.
    fn private_transfer(
        payment: PaymentRecord,
        recipient: address,
        amount: u64
    ) -> (PaymentRecord, PaymentRecord) {
        // The subtraction below would trap on underflow anyway, but asserting
        // first names the failure instead of dying inside arithmetic.
        assert(amount <= payment.amount);

        let to_recipient: PaymentRecord = PaymentRecord {
            owner: recipient,
            amount: amount,
            sender: payment.owner,
            memo: payment.memo,
        };

        let change: PaymentRecord = PaymentRecord {
            owner: payment.owner,
            amount: payment.amount - amount,
            sender: payment.sender,
            memo: payment.memo,
        };

        return (to_recipient, change);
    }

    // Sanctions screening.
    //
    // The list is public by design — real sanctions lists are published, so
    // hiding them buys nothing. What must stay private is *who was screened*,
    // and that is the private input here.
    //
    // Linear scan, so cost grows with the list. A Merkle-root version would
    // fix that; it is a stretch goal, not a port from ARCANUM (whose circuit
    // scans a public array too, despite what its README claims).
    fn prove_compliance(counterparty: address, sanctions: [field; 10]) -> bool {
        let subject: field = BHP256::hash_to_field(counterparty);
        let clean: bool = true;

        for i: u8 in 0u8..10u8 {
            clean = clean && (subject != sanctions[i]);
        }

        assert(clean);
        return clean;
    }
}
