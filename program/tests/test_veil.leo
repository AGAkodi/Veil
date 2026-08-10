// Tests for veil_attest_v2.aleo.
//
// Gated submission and selective disclosure verification tests.

import veil_attest_v2.aleo;

const USER: address = aleo1ldvqz7kdgjs7pr0tazmy5qpa3aydxvly2756e432sphn224u9c9s9cxtu2;
const INPUT_HASH: field = 123456789field;
const WRONG_HASH: field = 987654321field;

program test_veil.aleo {

    @noupgrade
    constructor() {}

    // Test: Oracle submits attestation -> succeeds.
    // We run this test with the oracle's private key.
    @test(private_key = "APrivateKey1zkpJ2uW8mrJ5ghfffGXFZ92gdv113WrziWBk2f8iy6TrZW8")
    fn test_oracle_submit_succeeds() -> Final {
        let (att, f) = veil_attest_v2.aleo::submit_attestation(USER, INPUT_HASH, true);

        assert_eq(att.owner, USER);
        assert_eq(att.input_hash, INPUT_HASH);
        assert_eq(att.verdict, true);
        assert_eq(att.oracle, aleo15m50rvhx0glq0hjv807c2t0z40et9ljmvdjrqv8f4pr8evzs2qysfnv2un);

        return final {
            f.run(); // Consume the finalization future from submit_attestation
            
            // Verify that the mappings were updated correctly.
            let total_att: u64 = Mapping::get(veil_attest_v2.aleo::total_attestations, 0u8);
            assert_eq(total_att, 1u64);

            let total_flg: u64 = Mapping::get(veil_attest_v2.aleo::total_flagged, 0u8);
            assert_eq(total_flg, 0u64);
        };
    }

    // Test: Oracle submits a flagged attestation (verdict = false) -> increments total_flagged.
    @test(private_key = "APrivateKey1zkpJ2uW8mrJ5ghfffGXFZ92gdv113WrziWBk2f8iy6TrZW8")
    fn test_flagged_submit_increments() -> Final {
        let (att, f) = veil_attest_v2.aleo::submit_attestation(USER, INPUT_HASH, false);

        assert_eq(att.verdict, false);

        return final {
            f.run(); // Consume the finalization future
            
            // Verify that the mappings were updated correctly.
            let total_att: u64 = Mapping::get(veil_attest_v2.aleo::total_attestations, 0u8);
            assert_eq(total_att, 1u64);

            let total_flg: u64 = Mapping::get(veil_attest_v2.aleo::total_flagged, 0u8);
            assert_eq(total_flg, 1u64);
        };
    }

    // Test: Non-oracle address attempts to submit -> fails.
    // Running without a specified private_key uses the default test runner key,
    // which does not match ORACLE_ADDRESS.
    @test
    @should_fail
    fn test_non_oracle_submit_fails() -> Final {
        let (att, f) = veil_attest_v2.aleo::submit_attestation(USER, INPUT_HASH, true);
        return final {
            f.run();
        };
    }

    // Test: Verify attestation with matching hash -> returns true.
    @test(private_key = "APrivateKey1zkpJ2uW8mrJ5ghfffGXFZ92gdv113WrziWBk2f8iy6TrZW8")
    fn test_verify_matching_succeeds() -> Final {
        let me: address = std::ctx::signer();
        // Oracle submits to create an attestation owned by me (so I can consume it)
        let (att, f) = veil_attest_v2.aleo::submit_attestation(me, INPUT_HASH, true);

        // Verify the attestation against the matching hash.
        // Returns (matches: bool, output_att: Attestation)
        let (matches, output_att) = veil_attest_v2.aleo::verify_attestation(att, INPUT_HASH);

        assert(matches);
        // Verify output record fields are preserved
        assert_eq(output_att.owner, me);
        assert_eq(output_att.input_hash, INPUT_HASH);
        assert_eq(output_att.verdict, true);

        return final {
            f.run();
        };
    }

    // Test: Verify attestation with mismatched hash -> returns false.
    @test(private_key = "APrivateKey1zkpJ2uW8mrJ5ghfffGXFZ92gdv113WrziWBk2f8iy6TrZW8")
    fn test_verify_mismatch_fails() -> Final {
        let me: address = std::ctx::signer();
        // Oracle submits to create an attestation owned by me (so I can consume it)
        let (att, f) = veil_attest_v2.aleo::submit_attestation(me, INPUT_HASH, true);

        // Verify against mismatched hash
        let (matches, output_att) = veil_attest_v2.aleo::verify_attestation(att, WRONG_HASH);

        // Should return false for matches
        assert_eq(matches, false);
        // Verify record is still intact and returned
        assert_eq(output_att.owner, me);
        assert_eq(output_att.input_hash, INPUT_HASH);

        return final {
            f.run();
        };
    }
}
