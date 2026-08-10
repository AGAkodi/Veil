// veil_attest.aleo — verifiable AI attestation protocol.
//
// Gated submission and selective disclosure verification.

// The single trusted oracle address allowed to submit attestations.
const ORACLE_ADDRESS: address = aleo15m50rvhx0glq0hjv807c2t0z40et9ljmvdjrqv8f4pr8evzs2qysfnv2un;

program veil_attest.aleo {

    // Deployment is final and cannot be upgraded.
    @noupgrade
    constructor() {}

    // An attestation record. Owned by the party who has disclosure rights.
    // All record fields are private by default unless exposed in transitions.
    record Attestation {
        owner: address,       // whoever holds the right to disclose this
        input_hash: field,    // commitment to the (private, off-chain) input
        verdict: bool,
        oracle: address,      // which agent/oracle produced this
    }

    // Submit an attestation. Gated to the ORACLE_ADDRESS.
    // owner: the target party who will own the disclosure rights.
    // input_hash: private commitment to avoid brute-forcing the input space.
    // verdict: public boolean representing the oracle's verdict.
    fn submit_attestation(
        public owner: address,
        private input_hash: field,
        public verdict: bool
    ) -> Attestation {
        // Enforce that only the trusted oracle can sign and submit the attestation.
        assert_eq(std::ctx::signer(), ORACLE_ADDRESS);

        return Attestation {
            owner: owner,
            input_hash: input_hash,
            verdict: verdict,
            oracle: std::ctx::signer(),
        };
    }

    // Verify the commitment hash inside an attestation.
    // Consumes the input record and outputs a recreated record to allow multiple checks.
    // claimed_hash: public hash being verified against the private record hash.
    fn verify_attestation(
        att: Attestation,
        public claimed_hash: field
    ) -> (bool, Attestation) {
        let matches: bool = (att.input_hash == claimed_hash);

        // Recreate the attestation record to support read-like semantics.
        let output_att: Attestation = Attestation {
            owner: att.owner,
            input_hash: att.input_hash,
            verdict: att.verdict,
            oracle: att.oracle,
        };

        return (matches, output_att);
    }
}
