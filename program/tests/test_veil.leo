// Tests for veil.aleo.
//
// Addresses below are freshly generated throwaways used only as literals.
// No private keys are stored here or anywhere in the repo.
//
// Leo 4.4.1 parser constraints worth knowing before editing this file:
//   - `const` must sit at file scope, not inside the `program { ... }` block
//   - `veil.aleo/PaymentRecord` does not parse as a `let` type annotation,
//     so record bindings are left to inference
//   - identifiers may not begin with `_` and are capped at 31 bytes

import veil.aleo;

const ALICE: address = aleo1ldvqz7kdgjs7pr0tazmy5qpa3aydxvly2756e432sphn224u9c9s9cxtu2;
const BOB: address = aleo10mchgsa7r9wh7szf046q97adzea8y6xda6s7xrvtmsw9pd03pczszppthv;
const MALLORY: address = aleo1clffv46hyee4hk2nk06umudxdpmm4m8xrl0r0nlvks7fgtmp5sysgtrmr2;

// A stand-in sanctions list. Entry 4 is MALLORY's hash, computed here so the
// fixture cannot drift from the address it is supposed to screen.
const SANCTIONS: [field; 10] = [
    1001field,
    1002field,
    1003field,
    1004field,
    BHP256::hash_to_field(MALLORY),
    1006field,
    1007field,
    1008field,
    1009field,
    1010field,
];

program test_veil.aleo {

    @noupgrade
    constructor() {}

    // --- private_transfer -------------------------------------------------

    @test
    fn test_partial_transfer() {
        let me: address = std::ctx::signer();
        let funded = veil.aleo::issue(me, 10_000u64, 0field);
        let (to_bob, change) = veil.aleo::private_transfer(funded, BOB, 3_000u64);

        assert_eq(to_bob.owner, BOB);
        assert_eq(to_bob.amount, 3_000u64);
        assert_eq(change.owner, me);
        assert_eq(change.amount, 7_000u64);
    }

    // The edge case the build plan flags: an exact-amount transfer must still
    // emit a change record, at zero. Suppressing it would leak, via the output
    // count, whether the sender drained the record.
    @test
    fn test_exact_amount_zero_change() {
        let me: address = std::ctx::signer();
        let funded = veil.aleo::issue(me, 5_000u64, 0field);
        let (to_bob, change) = veil.aleo::private_transfer(funded, BOB, 5_000u64);

        assert_eq(to_bob.amount, 5_000u64);
        assert_eq(change.amount, 0u64);
        assert_eq(change.owner, me);
    }

    @test
    @should_fail
    fn test_overspend_rejected() {
        let me: address = std::ctx::signer();
        let funded = veil.aleo::issue(me, 1_000u64, 0field);
        let (out, rest) = veil.aleo::private_transfer(funded, BOB, 1_001u64);
        assert_eq(out.amount, 1_001u64);
        assert_eq(rest.amount, 0u64);
    }

    // --- prove_compliance -------------------------------------------------

    @test
    fn test_clean_party_passes() {
        let ok: bool = veil.aleo::prove_compliance(BOB, SANCTIONS);
        assert(ok);
    }

    @test
    @should_fail
    fn test_sanctioned_blocked() {
        let ok: bool = veil.aleo::prove_compliance(MALLORY, SANCTIONS);
        assert(ok);
    }
}
