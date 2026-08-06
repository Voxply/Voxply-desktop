//! WebTransport client for voice (docs/docs/voice-transport-v2.md). Replaces
//! the old raw-UDP `VoiceSocket`: connects to the hub's
//! `voice_wt_url?token=<hex>` session and exchanges opaque datagrams (the
//! sealed uplink packets from `crypto.rs`) -- the encryption itself lives
//! one layer up, this module is purely transport.

use anyhow::{Context, Result};
use wtransport::tls::Sha256Digest;
use wtransport::{ClientConfig, Endpoint};

/// An open WebTransport voice session against a hub. Cheap to clone -- the
/// underlying `wtransport::Connection` is `Arc`-backed.
#[derive(Clone)]
pub struct VoiceTransport {
    connection: wtransport::Connection,
}

impl VoiceTransport {
    /// Connects to `voice_wt_url?token=<voice_token>`. When `cert_hash_hex`
    /// is set (self-signed tier), trusts exactly that certificate by
    /// SHA-256 digest, matching the browser
    /// `WebTransportOptions.serverCertificateHashes` trust model; otherwise
    /// falls back to normal CA validation (operator-supplied cert).
    pub async fn connect(
        voice_wt_url: &str,
        voice_token: &str,
        cert_hash_hex: Option<&str>,
    ) -> Result<Self> {
        let builder = ClientConfig::builder().with_bind_default();
        let config = match cert_hash_hex {
            Some(hash_hex) => {
                let bytes = hex::decode(hash_hex).context("invalid voice_cert_hash hex")?;
                let digest: [u8; 32] = bytes.try_into().map_err(|_| {
                    anyhow::anyhow!("voice_cert_hash must be a 32-byte SHA-256 digest")
                })?;
                builder
                    .with_server_certificate_hashes([Sha256Digest::new(digest)])
                    .build()
            }
            None => builder.with_native_certs().build(),
        };

        let endpoint = Endpoint::client(config).context("wtransport client endpoint")?;
        let session_url = format!("{voice_wt_url}?token={voice_token}");
        let connection = endpoint
            .connect(&session_url)
            .await
            .context("wtransport connect")?;

        Ok(Self { connection })
    }

    /// Sends an unreliable/unordered datagram -- the sealed uplink packet.
    pub fn send_datagram(&self, payload: &[u8]) -> Result<()> {
        self.connection
            .send_datagram(payload)
            .context("wtransport send_datagram")
    }

    /// Waits for the next datagram from the hub relay (routing prefix +
    /// sealed packet, unparsed).
    pub async fn recv_datagram(&self) -> Result<Vec<u8>> {
        let datagram = self
            .connection
            .receive_datagram()
            .await
            .context("wtransport receive_datagram")?;
        Ok(datagram.payload().to_vec())
    }
}
