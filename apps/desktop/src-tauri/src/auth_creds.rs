use std::path::PathBuf;

use crate::identity::{DeviceSubkey, Identity, SubkeyCert};

use crate::pairing::PairedIdentity;

fn paired_identity_path() -> Result<PathBuf, String> {
    crate::accounts::active_paired_identity_path()
}

fn read_paired_identity() -> Option<PairedIdentity> {
    let path = paired_identity_path().ok()?;
    if !path.exists() {
        return None;
    }
    let text = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&text).ok()
}

enum SigningSource {
    Legacy(Identity),
    Subkey(DeviceSubkey),
}

pub struct AuthCredentials {
    pub public_key_hex: String,
    signing_source: SigningSource,
    pub cert: Option<SubkeyCert>,
    pub security_nonce: u64,
    pub security_level: u32,
}

impl AuthCredentials {
    /// Sign a cert for this very device under the master its own seed derives.
    /// Only an entropy-holding identity can: a paired device's seed is a
    /// subkey and would derive some unrelated master.
    fn self_signed_cert(&self, identity: &Identity, hub_url: &str) -> Result<SubkeyCert, String> {
        let master = identity.master().map_err(|e| e.to_string())?;
        let master_pubkey = master.public_key_hex();
        let subkey_pubkey = identity.public_key_hex();
        // `Identity` carries no label — only a paired `DeviceSubkey` does, and
        // desktop has no rename UI yet. Same default string web issues its own
        // self-cert with, so a user with both sees one convention.
        let device_label = "This device".to_string();
        let issued_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let fallback_hubs = vec![hub_url.trim_end_matches('/').to_string()];
        let bytes = SubkeyCert::signing_bytes(
            &master_pubkey,
            &subkey_pubkey,
            &device_label,
            issued_at,
            None,
            &fallback_hubs,
        );
        Ok(SubkeyCert {
            master_pubkey,
            subkey_pubkey,
            device_label,
            issued_at,
            not_after: None,
            fallback_hubs,
            signature: hex::encode(master.sign(&bytes).to_bytes()),
        })
    }

    pub fn sign(&self, msg: &[u8]) -> [u8; 64] {
        match &self.signing_source {
            SigningSource::Legacy(id) => id.sign(msg).to_bytes(),
            SigningSource::Subkey(sk) => sk.sign(msg).to_bytes(),
        }
    }

    /// Run the challenge/verify dance against a hub URL. Returns the
    /// session token. The verify request always carries a master-signed
    /// cert — the one a paired identity was handed, or one an
    /// entropy-holding identity signs for itself — so the hub can resolve
    /// this pubkey to the canonical identity and record its master.
    pub async fn authenticate(
        &self,
        hub_url: &str,
        client: &reqwest::Client,
        invite_code: Option<&str>,
    ) -> Result<String, String> {
        let challenge_raw = client
            .post(format!("{hub_url}/auth/challenge"))
            .json(&serde_json::json!({ "public_key": self.public_key_hex }))
            .send()
            .await
            .map_err(|e| format!("challenge: {e}"))?;
        if !challenge_raw.status().is_success() {
            let status = challenge_raw.status();
            let body = challenge_raw.text().await.unwrap_or_default();
            return Err(format!("challenge rejected ({status}): {body}"));
        }
        let challenge_resp: ChallengeResponse = challenge_raw
            .json()
            .await
            .map_err(|e| format!("challenge decode: {e}"))?;

        let challenge_bytes = hex::decode(&challenge_resp.challenge)
            .map_err(|e| format!("bad challenge hex: {e}"))?;
        let signature_bytes = self.sign(&challenge_bytes);

        let mut body = serde_json::json!({
            "public_key": self.public_key_hex,
            "challenge": challenge_resp.challenge,
            "signature": hex::encode(signature_bytes),
            "security_nonce": self.security_nonce,
            "security_level": self.security_level,
        });
        // A paired device presents the cert it was handed; an entropy-holding
        // one signs its own here. Either way the hub learns which master this
        // roster pubkey belongs to, and that link is the only thing that makes
        // a home hub list findable — without it no hub can resolve the list a
        // DM should be delivered to, and fan-out and mirroring skip this
        // identity in silence.
        //
        // Built here rather than in `load_active_credentials` because the cert
        // carries the hub URL as its designation-of-last-resort, and only the
        // caller knows it. Nothing persists it: it is re-derivable from the
        // seed, the hub upserts by (master, subkey), and desktop reads device
        // certs from the hub rather than from disk.
        let self_cert = match (&self.cert, &self.signing_source) {
            (None, SigningSource::Legacy(identity)) => {
                Some(self.self_signed_cert(identity, hub_url)?)
            }
            _ => None,
        };
        if let Some(cert) = self.cert.as_ref().or(self_cert.as_ref()) {
            body["subkey_cert"] =
                serde_json::to_value(cert).map_err(|e| format!("serialize cert: {e}"))?;
        }
        if let Some(code) = invite_code {
            body["invite_code"] = serde_json::Value::String(code.to_string());
        }

        let resp = client
            .post(format!("{hub_url}/auth/verify"))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("verify: {e}"))?;
        if !resp.status().is_success() {
            return Err(format!(
                "verify rejected ({}): {}",
                resp.status(),
                resp.text().await.unwrap_or_default()
            ));
        }
        let verify: VerifyResponse = resp
            .json()
            .await
            .map_err(|e| format!("verify decode: {e}"))?;
        Ok(verify.token)
    }
}

/// Load whichever identity should be used to authenticate against
/// hubs. If a paired_identity.json file exists, that takes precedence
/// — the device authenticates with its subkey and presents the
/// master-signed cert. Otherwise the legacy single-key identity is
/// used (with no cert).
pub fn load_active_credentials() -> Result<AuthCredentials, String> {
    if let Some(paired) = read_paired_identity() {
        let secret = hex::decode(&paired.subkey_secret_hex)
            .map_err(|e| format!("decode subkey secret: {e}"))?;
        let secret_array: [u8; 32] = secret
            .try_into()
            .map_err(|_| "subkey secret must be 32 bytes".to_string())?;
        let subkey = DeviceSubkey::from_secret_bytes(&secret_array, paired.device_label.clone());
        // Subkey devices bypass PoW — the pairing relationship is already a
        // trust gate; requiring PoW per-subkey would penalise legitimate users.
        return Ok(AuthCredentials {
            public_key_hex: paired.subkey_pubkey,
            signing_source: SigningSource::Subkey(subkey),
            cert: Some(paired.cert),
            security_nonce: 0,
            security_level: 0,
        });
    }

    let path = Identity::default_path().map_err(|e| e.to_string())?;
    let (identity, _) = Identity::load_or_create(&path).map_err(|e| e.to_string())?;
    let public_key_hex = identity.public_key_hex();
    let security_nonce = identity.security_nonce;
    let security_level = identity.security_level;
    Ok(AuthCredentials {
        public_key_hex,
        signing_source: SigningSource::Legacy(identity),
        cert: None,
        security_nonce,
        security_level,
    })
}

// Locally-defined to avoid pulling lib.rs's auth response types into
// this module's dependency graph. They're trivially serde-compatible.

#[derive(serde::Deserialize)]
struct ChallengeResponse {
    challenge: String,
}

#[derive(serde::Deserialize)]
struct VerifyResponse {
    token: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    // The hub verifies this cert's signature against the master named inside
    // it, and links that master to the roster pubkey. Get either half wrong
    // and nothing reports it: auth still succeeds, the link is just never
    // made, and the identity stays invisible to every home-hub lookup.
    #[test]
    fn an_entropy_holding_identity_signs_a_cert_the_hub_will_accept() {
        let identity = Identity::generate();
        let creds = AuthCredentials {
            public_key_hex: identity.public_key_hex(),
            signing_source: SigningSource::Legacy(identity),
            cert: None,
            security_nonce: 0,
            security_level: 0,
        };
        let SigningSource::Legacy(ref id) = creds.signing_source else {
            unreachable!()
        };

        let cert = creds
            .self_signed_cert(id, "https://hub.example/")
            .expect("an identity holding entropy can always sign for itself");

        cert.verify().expect("cert must verify against its master");
        assert_eq!(cert.subkey_pubkey, creds.public_key_hex);
        assert_eq!(
            cert.master_pubkey,
            id.master().unwrap().public_key_hex(),
            "the cert must name the master this seed derives, or the link points nowhere"
        );
        // Trailing slash stripped: the designation and the fallback list are
        // compared as strings, so two spellings of one hub are two hubs.
        assert_eq!(cert.fallback_hubs, vec!["https://hub.example".to_string()]);
    }
}
