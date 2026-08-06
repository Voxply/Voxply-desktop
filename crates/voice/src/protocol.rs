use anyhow::Result;

pub const SAMPLE_RATE: u32 = 48_000;
pub const CHANNELS: u16 = 1;
pub const FRAME_DURATION_MS: u32 = 20;
pub const FRAME_SIZE: usize = 960;
pub const MAX_PACKET_SIZE: usize = 1275;
pub const RING_BUFFER_SIZE: usize = 9600;

/// Downlink relay prefix the hub prepends verbatim to every forwarded
/// datagram (voice-transport-v2.md): `[sender_id: u16 BE][packet_type: u8]`,
/// followed by the sealed uplink packet unchanged. 3 bytes total; the
/// legacy 8/9-byte cleartext header (sequence/timestamp in the clear) is
/// gone -- everything past the relay prefix is opaque ciphertext to the hub
/// and to this parser.
pub const RELAY_PREFIX_LEN: usize = 3;

/// A packet as received from the hub relay: routing bytes plus the sealed
/// uplink packet, not yet decrypted (the pipeline resolves the sender's
/// current key by `key_id` -- see `crypto::peek_header` -- before opening).
pub struct ReceivedVoicePacket {
    pub sender_id: u16,
    /// 0x00 = normal channel voice, 0x01 = whisper (hub-routed).
    pub packet_type: u8,
    pub sealed: Vec<u8>,
}

impl ReceivedVoicePacket {
    /// Returns true when this packet carries whisper audio (`packet_type == 0x01`).
    pub fn is_whisper(&self) -> bool {
        self.packet_type == 0x01
    }

    pub fn deserialize(data: &[u8]) -> Result<Self> {
        if data.len() < RELAY_PREFIX_LEN {
            anyhow::bail!("Received packet too short: {} bytes", data.len());
        }
        let sender_id = u16::from_be_bytes([data[0], data[1]]);
        let packet_type = data[2];
        let sealed = data[RELAY_PREFIX_LEN..].to_vec();
        Ok(Self {
            sender_id,
            packet_type,
            sealed,
        })
    }
}
