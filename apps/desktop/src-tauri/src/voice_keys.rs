// Voice-transport v2 E2E key distribution (docs/docs/voice-transport-v2.md).
//
// Mirrors `server/crates/identity/src/voice.rs`'s `voice_key_wrap` /
// `voice_key_unwrap` byte-for-byte -- this crate cannot depend on the
// server's `identity` crate, so the construction is duplicated here,
// following the same hand-written-mirror convention as `dm.rs`
// (`wrap_chain_key`, whose construction this parallels with a distinct HKDF
// info tag). Packet seal/open live in `wavvon_voice::crypto` instead, since
// that side needs no `Identity`/DH-fetch plumbing.

use crate::identity::Identity;
use crate::types::VoiceKeyBundleInfo;
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use hkdf::Hkdf;
use rand::RngCore;
use sha2::Sha256;
use wavvon_voice::SenderKeyGen;

/// HKDF info tag for the key-wrap construction. No NUL terminator -- HKDF
/// info convention, matching `wavvon/group-key-dist/v1`.
const VOICE_KEY_INFO: &[u8] = b"wavvon/voice-key/v1";

/// Wrapped-key plaintext layout: `sender_key[32] || nonce_salt[4] || key_id_be[4]`.
const WRAP_PLAINTEXT_LEN: usize = 40;

/// Generates a fresh sender key: random 32-byte AES key + random 4-byte
/// nonce salt, at the given generation counter. Called on voice join
/// (`key_id = 1`) and on rotation (`key_id = previous + 1`).
pub(crate) fn generate_sender_key(key_id: u32) -> SenderKeyGen {
    let mut sender_key = [0u8; 32];
    let mut nonce_salt = [0u8; 4];
    rand::thread_rng().fill_bytes(&mut sender_key);
    rand::thread_rng().fill_bytes(&mut nonce_salt);
    SenderKeyGen {
        sender_key,
        nonce_salt,
        key_id,
    }
}

fn voice_wrap_key(shared_secret: &[u8], channel_id: &str) -> Result<[u8; 32], String> {
    let hk = Hkdf::<Sha256>::new(Some(channel_id.as_bytes()), shared_secret);
    let mut wrap_key = [0u8; 32];
    hk.expand(VOICE_KEY_INFO, &mut wrap_key)
        .map_err(|e| format!("HKDF expand: {e}"))?;
    Ok(wrap_key)
}

/// Wraps a voice sender key for one recipient: static-static X25519 between
/// our DH keypair and the recipient's DH public key, then
/// HKDF-SHA256(salt=channel_id) → AES-256-GCM over the 40-byte plaintext.
/// Returns `(ciphertext_hex, nonce_hex)`.
pub(crate) fn voice_key_wrap(
    my_dh_sec: &x25519_dalek::StaticSecret,
    recipient_dh_pub: &x25519_dalek::PublicKey,
    channel_id: &str,
    gen: &SenderKeyGen,
) -> Result<(String, String), String> {
    let mut nonce = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce);
    let ciphertext =
        voice_key_wrap_with_nonce(my_dh_sec, recipient_dh_pub, channel_id, gen, &nonce)?;
    Ok((hex::encode(ciphertext), hex::encode(nonce)))
}

fn voice_key_wrap_with_nonce(
    my_dh_sec: &x25519_dalek::StaticSecret,
    recipient_dh_pub: &x25519_dalek::PublicKey,
    channel_id: &str,
    gen: &SenderKeyGen,
    nonce: &[u8; 12],
) -> Result<Vec<u8>, String> {
    let shared = my_dh_sec.diffie_hellman(recipient_dh_pub);
    let wrap_key = voice_wrap_key(shared.as_bytes(), channel_id)?;

    let mut plaintext = [0u8; WRAP_PLAINTEXT_LEN];
    plaintext[..32].copy_from_slice(&gen.sender_key);
    plaintext[32..36].copy_from_slice(&gen.nonce_salt);
    plaintext[36..40].copy_from_slice(&gen.key_id.to_be_bytes());

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&wrap_key));
    cipher
        .encrypt(Nonce::from_slice(nonce), plaintext.as_slice())
        .map_err(|e| format!("AES-GCM encrypt: {e}"))
}

/// Unwraps a voice sender key sent to us.
pub(crate) fn voice_key_unwrap(
    my_dh_sec: &x25519_dalek::StaticSecret,
    sender_dh_pub: &x25519_dalek::PublicKey,
    channel_id: &str,
    ciphertext_hex: &str,
    nonce_hex: &str,
) -> Result<SenderKeyGen, String> {
    let ciphertext =
        hex::decode(ciphertext_hex).map_err(|e| format!("invalid ciphertext hex: {e}"))?;
    let nonce_bytes = hex::decode(nonce_hex).map_err(|e| format!("invalid nonce hex: {e}"))?;
    let nonce_arr: [u8; 12] = nonce_bytes
        .try_into()
        .map_err(|_| "wrap nonce must be 12 bytes".to_string())?;

    let shared = my_dh_sec.diffie_hellman(sender_dh_pub);
    let wrap_key = voice_wrap_key(shared.as_bytes(), channel_id)?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&wrap_key));
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce_arr), ciphertext.as_slice())
        .map_err(|e| format!("AES-GCM decrypt: {e}"))?;

    if plaintext.len() != WRAP_PLAINTEXT_LEN {
        return Err(format!(
            "wrapped voice key plaintext must be {WRAP_PLAINTEXT_LEN} bytes, got {}",
            plaintext.len()
        ));
    }

    let mut sender_key = [0u8; 32];
    sender_key.copy_from_slice(&plaintext[..32]);
    let mut nonce_salt = [0u8; 4];
    nonce_salt.copy_from_slice(&plaintext[32..36]);
    let key_id = u32::from_be_bytes(plaintext[36..40].try_into().unwrap());

    Ok(SenderKeyGen {
        sender_key,
        nonce_salt,
        key_id,
    })
}

/// Builds one `VoiceKeyBundleInfo` per recipient: fetches each recipient's
/// published DH key (`GET /identity/{member}/dh-key`, same fetch `dm.rs`
/// uses for group-DM key distribution) and wraps `gen` for them. Recipients
/// with no published DH key, or any other per-recipient failure, are
/// silently skipped -- matching the hub's "unknown recipients are silently
/// dropped" convention for `VoiceKeyOffer`.
///
/// DH-scalar selection matches the desktop DM path exactly, because both go
/// through `Identity::e2e_dh_secret()` -- the canonical scalar provisioned at
/// pairing time on a paired device (multi-device.md "Mechanism A"), the
/// seed-derived one otherwise. Mirrors web's `resolveDmSendAttribution`.
pub(crate) async fn build_offer_bundles(
    client: &reqwest::Client,
    hub_url: &str,
    token: &str,
    identity: &Identity,
    channel_id: &str,
    gen: &SenderKeyGen,
    recipients: &[String],
) -> Vec<VoiceKeyBundleInfo> {
    let my_dh_sec = identity.e2e_dh_secret();
    let mut bundles = Vec::new();
    for pubkey in recipients {
        let Some(dh_hex) = crate::dm::fetch_dh_key_http(client, hub_url, token, pubkey).await
        else {
            continue;
        };
        let Ok(dh_bytes) = hex::decode(&dh_hex) else {
            continue;
        };
        let Ok(dh_arr): Result<[u8; 32], _> = dh_bytes.try_into() else {
            continue;
        };
        let recipient_pub = x25519_dalek::PublicKey::from(dh_arr);
        let Ok((ciphertext_hex, nonce_hex)) =
            voice_key_wrap(&my_dh_sec, &recipient_pub, channel_id, gen)
        else {
            continue;
        };
        bundles.push(VoiceKeyBundleInfo {
            recipient_pubkey: pubkey.clone(),
            ciphertext_hex,
            nonce_hex,
        });
    }
    bundles
}

// ---------------------------------------------------------------------------
// Wire vectors (voice-transport-v2.md — canonical, do not adjust)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod wire_vector_tests {
    use super::*;
    use sha2::{Digest, Sha512};

    fn seed(fill_from: u8) -> [u8; 32] {
        let mut s = [0u8; 32];
        for (i, b) in s.iter_mut().enumerate() {
            *b = fill_from.wrapping_add(i as u8);
        }
        s
    }

    /// Same ed25519→x25519 derivation as `Identity::dh_keypair`, applied
    /// directly to a fixed seed (test vectors don't go through an
    /// `Identity`, they exercise the wrap/unwrap functions with
    /// already-derived DH keys, per the production signature).
    fn dh_secret_from_seed(seed: &[u8; 32]) -> x25519_dalek::StaticSecret {
        let hash = Sha512::digest(seed);
        let mut scalar = [0u8; 32];
        scalar.copy_from_slice(&hash[..32]);
        scalar[0] &= 248;
        scalar[31] &= 127;
        scalar[31] |= 64;
        x25519_dalek::StaticSecret::from(scalar)
    }

    fn voice_sender_seed() -> [u8; 32] {
        seed(0x61)
    }

    fn voice_recipient_seed() -> [u8; 32] {
        seed(0x81)
    }

    const VOICE_CHANNEL_ID: &str = "chan-vector-1";
    const VOICE_SENDER_KEY: [u8; 32] = [
        0xc1, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xcb, 0xcc, 0xcd, 0xce, 0xcf,
        0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xdb, 0xdc, 0xdd, 0xde,
        0xdf, 0xe0,
    ];
    const VOICE_NONCE_SALT: [u8; 4] = [0xaa, 0xbb, 0xcc, 0xdd];
    const VOICE_KEY_ID: u32 = 99;
    const VOICE_WRAP_NONCE: [u8; 12] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    const VOICE_KEY_WRAP_CIPHERTEXT_HEX: &str = "98c781916feb2ea99f7dbf23f15fd58bb9ab8613ec348ebe8c93814ee695a11de59ce0341e00d354b9ff665b5ab38d27a0ab526c71cf495e";

    fn gen() -> SenderKeyGen {
        SenderKeyGen {
            sender_key: VOICE_SENDER_KEY,
            nonce_salt: VOICE_NONCE_SALT,
            key_id: VOICE_KEY_ID,
        }
    }

    #[test]
    fn voice_key_wrap_ciphertext_vector() {
        let sender_sec = dh_secret_from_seed(&voice_sender_seed());
        let recipient_sec = dh_secret_from_seed(&voice_recipient_seed());
        let recipient_pub = x25519_dalek::PublicKey::from(&recipient_sec);

        let ciphertext = voice_key_wrap_with_nonce(
            &sender_sec,
            &recipient_pub,
            VOICE_CHANNEL_ID,
            &gen(),
            &VOICE_WRAP_NONCE,
        )
        .unwrap();
        assert_eq!(hex::encode(&ciphertext), VOICE_KEY_WRAP_CIPHERTEXT_HEX);
    }

    #[test]
    fn voice_key_unwrap_round_trips_vector() {
        let sender_sec = dh_secret_from_seed(&voice_sender_seed());
        let sender_pub = x25519_dalek::PublicKey::from(&sender_sec);
        let recipient_sec = dh_secret_from_seed(&voice_recipient_seed());
        let recipient_pub = x25519_dalek::PublicKey::from(&recipient_sec);

        let ciphertext = voice_key_wrap_with_nonce(
            &sender_sec,
            &recipient_pub,
            VOICE_CHANNEL_ID,
            &gen(),
            &VOICE_WRAP_NONCE,
        )
        .unwrap();

        let unwrapped = voice_key_unwrap(
            &recipient_sec,
            &sender_pub,
            VOICE_CHANNEL_ID,
            &hex::encode(&ciphertext),
            &hex::encode(VOICE_WRAP_NONCE),
        )
        .unwrap();

        assert_eq!(unwrapped.sender_key, VOICE_SENDER_KEY);
        assert_eq!(unwrapped.nonce_salt, VOICE_NONCE_SALT);
        assert_eq!(unwrapped.key_id, VOICE_KEY_ID);
    }

    #[test]
    fn voice_key_unwrap_rejects_tampered_ciphertext() {
        let sender_sec = dh_secret_from_seed(&voice_sender_seed());
        let sender_pub = x25519_dalek::PublicKey::from(&sender_sec);
        let recipient_sec = dh_secret_from_seed(&voice_recipient_seed());
        let recipient_pub = x25519_dalek::PublicKey::from(&recipient_sec);

        let mut ciphertext = voice_key_wrap_with_nonce(
            &sender_sec,
            &recipient_pub,
            VOICE_CHANNEL_ID,
            &gen(),
            &VOICE_WRAP_NONCE,
        )
        .unwrap();
        ciphertext[0] ^= 0xFF;

        let result = voice_key_unwrap(
            &recipient_sec,
            &sender_pub,
            VOICE_CHANNEL_ID,
            &hex::encode(&ciphertext),
            &hex::encode(VOICE_WRAP_NONCE),
        );
        assert!(result.is_err());
    }

    #[test]
    fn voice_key_unwrap_rejects_wrong_channel() {
        let sender_sec = dh_secret_from_seed(&voice_sender_seed());
        let sender_pub = x25519_dalek::PublicKey::from(&sender_sec);
        let recipient_sec = dh_secret_from_seed(&voice_recipient_seed());
        let recipient_pub = x25519_dalek::PublicKey::from(&recipient_sec);

        let ciphertext = voice_key_wrap_with_nonce(
            &sender_sec,
            &recipient_pub,
            VOICE_CHANNEL_ID,
            &gen(),
            &VOICE_WRAP_NONCE,
        )
        .unwrap();

        let result = voice_key_unwrap(
            &recipient_sec,
            &sender_pub,
            "chan-vector-2",
            &hex::encode(&ciphertext),
            &hex::encode(VOICE_WRAP_NONCE),
        );
        assert!(result.is_err());
    }
}
