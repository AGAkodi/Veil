program veil_attest_v2.aleo;

record Attestation:
    owner as address.private;
    input_hash as field.private;
    verdict as boolean.private;
    oracle as address.private;

mapping total_attestations:
    key as u8.public;
    value as u64.public;

mapping total_flagged:
    key as u8.public;
    value as u64.public;

function submit_attestation:
    input r0 as address.public;
    input r1 as field.private;
    input r2 as boolean.public;
    assert.eq self.signer aleo15m50rvhx0glq0hjv807c2t0z40et9ljmvdjrqv8f4pr8evzs2qysfnv2un;
    cast r0 r1 r2 self.signer into r3 as Attestation.record;
    async submit_attestation r2 into r4;
    output r3 as Attestation.record;
    output r4 as veil_attest_v2.aleo/submit_attestation.future;

finalize submit_attestation:
    input r0 as boolean.public;
    get.or_use total_attestations[0u8] 0u64 into r1;
    add r1 1u64 into r2;
    set r2 into total_attestations[0u8];
    get.or_use total_flagged[0u8] 0u64 into r3;
    ternary r0 0u64 1u64 into r4;
    add r3 r4 into r5;
    set r5 into total_flagged[0u8];

function verify_attestation:
    input r0 as Attestation.record;
    input r1 as field.public;
    is.eq r0.input_hash r1 into r2;
    cast r0.owner r0.input_hash r0.verdict r0.oracle into r3 as Attestation.record;
    output r2 as boolean.private;
    output r3 as Attestation.record;

constructor:
    assert.eq edition 0u16;
