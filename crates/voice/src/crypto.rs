//! Voice-transport v2 per-packet AEAD (see `docs/docs/voice-transport-v2.md`).
//! Pure Rust, no I/O — mirrors `server/crates/identity/src/voice.rs`'s
//! `voice_packet_seal`/`voice_packet_open` byte-for-byte. This crate cannot
//! depend on the server's `identity` crate (client crates carry their own
//! mirrors per repo convention), so the construction is duplicated here.
//!
//! Key-wrap (`voice_key_wrap`/`voice_key_unwrap`) is *not* in this crate —
//! it needs the desktop shell's `Identity` type (for the DH keypair and the
//! `GET /identity/{member}/dh-key` fetch), so it lives in
//! `apps/desktop/src-tauri/src/voice_keys.rs` instead.
//!
//! Header = `key_id_be[4] || ctr_be[8] || ts_be[4]` (cleartext, doubles as
//! AES-256-GCM AAD). Nonce = `nonce_salt[4] || ctr_be[8]` — unique for the
//! lifetime of a given `sender_key` as long as `ctr` never repeats.

use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Key, Nonce,
};
use anyhow::{anyhow, Result};

/// Uplink packet header layout: `key_id_be[4] || ctr_be[8] || ts_be[4]`.
pub const PACKET_HEADER_LEN: usize = 16;

/// Seal an uplink voice packet. Returns `header || ciphertext_and_tag`.
///
/// Never fails: `sender_key` is always exactly 32 bytes and AES-256-GCM has
/// no other failure mode for the message sizes voice packets use.
pub fn voice_packet_seal(
    sender_key: &[u8; 32],
    nonce_salt: &[u8; 4],
    key_id: u32,
    ctr: u64,
    ts: u32,
    opus: &[u8],
) -> Vec<u8> {
    let mut header = [0u8; PACKET_HEADER_LEN];
    header[0..4].copy_from_slice(&key_id.to_be_bytes());
    header[4..12].copy_from_slice(&ctr.to_be_bytes());
    header[12..16].copy_from_slice(&ts.to_be_bytes());

    let mut nonce_bytes = [0u8; 12];
    nonce_bytes[..4].copy_from_slice(nonce_salt);
    nonce_bytes[4..].copy_from_slice(&ctr.to_be_bytes());

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(sender_key));
    let ciphertext = cipher
        .encrypt(
            Nonce::from_slice(&nonce_bytes),
            Payload {
                msg: opus,
                aad: &header,
            },
        )
        .expect("AES-256-GCM encrypt cannot fail for voice packet sizes");

    let mut packet = Vec::with_capacity(PACKET_HEADER_LEN + ciphertext.len());
    packet.extend_from_slice(&header);
    packet.extend_from_slice(&ciphertext);
    packet
}

/// Open a sealed uplink voice packet. Returns `(key_id, ctr, ts, opus)`.
/// Rejects packets shorter than header(16) + GCM tag(16) = 32 bytes.
pub fn voice_packet_open(
    sender_key: &[u8; 32],
    nonce_salt: &[u8; 4],
    packet: &[u8],
) -> Result<(u32, u64, u32, Vec<u8>)> {
    const MIN_LEN: usize = PACKET_HEADER_LEN + 16; // header + GCM tag
    if packet.len() < MIN_LEN {
        return Err(anyhow!(
            "voice packet too short: {} bytes, minimum {MIN_LEN}",
            packet.len()
        ));
    }

    let header = &packet[..PACKET_HEADER_LEN];
    let key_id = u32::from_be_bytes(header[0..4].try_into().unwrap());
    let ctr = u64::from_be_bytes(header[4..12].try_into().unwrap());
    let ts = u32::from_be_bytes(header[12..16].try_into().unwrap());

    let mut nonce_bytes = [0u8; 12];
    nonce_bytes[..4].copy_from_slice(nonce_salt);
    nonce_bytes[4..].copy_from_slice(&ctr.to_be_bytes());

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(sender_key));
    let opus = cipher
        .decrypt(
            Nonce::from_slice(&nonce_bytes),
            Payload {
                msg: &packet[PACKET_HEADER_LEN..],
                aad: header,
            },
        )
        .map_err(|e| anyhow!("AES-GCM decrypt: {e}"))?;

    Ok((key_id, ctr, ts, opus))
}

/// Reads `(key_id, ctr, ts)` from a sealed packet's cleartext header without
/// the key. The receive path uses this to pick which key generation to try
/// (by `key_id`) and check the replay watermark (by `ctr`) before spending a
/// decrypt attempt.
pub fn peek_header(packet: &[u8]) -> Option<(u32, u64, u32)> {
    if packet.len() < PACKET_HEADER_LEN {
        return None;
    }
    let key_id = u32::from_be_bytes(packet[0..4].try_into().unwrap());
    let ctr = u64::from_be_bytes(packet[4..12].try_into().unwrap());
    let ts = u32::from_be_bytes(packet[12..16].try_into().unwrap());
    Some((key_id, ctr, ts))
}

// ---------------------------------------------------------------------------
// Wire vectors (voice-transport-v2.md — canonical, do not adjust)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    const SENDER_KEY: [u8; 32] = [
        0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xcb, 0xcc, 0xcd, 0xce, 0xcf,
        0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde,
        0xdf, 0xe0,
    ];
    const NONCE_SALT: [u8; 4] = [0xaa, 0xbb, 0xcc, 0xdd];
    const KEY_ID: u32 = 99;

    const PACKET_CTR0_HEX: &str = "000000630000000000000000000003e832dbc83526f73e83a90b59aaab331078f359b00fcfab1fa0e6c514ea2034da79b2";
    const PACKET_CTR7_HEX: &str = "0000006300000000000000070000138823adf6d5a771baa49d8de5ed1c99e5d5f12e9fffa9ba4fb471ca80882171360024";

    #[test]
    fn packet_seal_ctr0_vector() {
        let packet = voice_packet_seal(
            &SENDER_KEY,
            &NONCE_SALT,
            KEY_ID,
            0,
            1000,
            b"opus-frame-vector",
        );
        assert_eq!(hex::encode(&packet), PACKET_CTR0_HEX);
    }

    #[test]
    fn packet_seal_ctr7_vector() {
        let packet = voice_packet_seal(
            &SENDER_KEY,
            &NONCE_SALT,
            KEY_ID,
            7,
            5000,
            b"opus-frame-vector",
        );
        assert_eq!(hex::encode(&packet), PACKET_CTR7_HEX);
    }

    #[test]
    fn packet_open_round_trips_ctr0_and_ctr7_vectors() {
        for hex_packet in [PACKET_CTR0_HEX, PACKET_CTR7_HEX] {
            let packet = hex::decode(hex_packet).unwrap();
            let (key_id, _ctr, _ts, opus) =
                voice_packet_open(&SENDER_KEY, &NONCE_SALT, &packet).unwrap();
            assert_eq!(key_id, KEY_ID);
            assert_eq!(opus, b"opus-frame-vector");
        }
    }

    #[test]
    fn packet_open_rejects_short_packet() {
        let result = voice_packet_open(&SENDER_KEY, &NONCE_SALT, &[0u8; 31]);
        assert!(result.is_err());
    }

    #[test]
    fn packet_open_rejects_tampered_header() {
        let mut packet = voice_packet_seal(
            &SENDER_KEY,
            &NONCE_SALT,
            KEY_ID,
            0,
            1000,
            b"opus-frame-vector",
        );
        packet[0] ^= 0xFF; // flip a header byte (key_id)
        let result = voice_packet_open(&SENDER_KEY, &NONCE_SALT, &packet);
        assert!(result.is_err());
    }

    #[test]
    fn peek_header_matches_seal_inputs() {
        let packet = voice_packet_seal(&SENDER_KEY, &NONCE_SALT, KEY_ID, 42, 9000, b"x");
        assert_eq!(peek_header(&packet), Some((KEY_ID, 42, 9000)));
    }

    #[test]
    fn peek_header_rejects_short_packet() {
        assert_eq!(peek_header(&[0u8; 15]), None);
    }
}
