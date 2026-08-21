// Local speech detection, for the speaking indicator and the AFK sweep.
//
// The hub cannot do this for us any more, and that is by design: voice v2
// encrypts every packet end to end and the relay forwards headers only, so it
// cannot tell speech from silence. It already has the whole chain built —
// `voice_speaking` (client → hub) becomes `voice_participant_speaking`
// (hub → everyone), which the web client turns into `voiceActiveUsers` and
// UserListGrouped renders. No client ever sent the first message, so the chain
// was dead at the first link.
//
// Two things depended on it. The indicator, which simply never appeared, and
// `voice_last_active` — stamped on join and on every `voice_speaking` — which
// drives the AFK worker. With nothing reporting speech, a hub with an AFK
// channel configured moved *everyone* out once the timeout passed, however
// much they were talking.

/** Root-mean-square amplitude of a capture frame, in 0..1. */
export function frameEnergy(frame: Float32Array): number {
  if (frame.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

export interface SpeakingState {
  speaking: boolean;
  /** Timestamp (ms) when the frame energy last exceeded the threshold. */
  lastLoudAt: number;
}

export interface SpeakingOptions {
  /** Energy above which a frame counts as speech. Defaults to the value the
   *  voice settings have always exposed as `customVadThreshold`. */
  threshold: number;
  /** How long the signal must stay quiet before speaking turns off. Without
   *  this the indicator would strobe on every pause between words. */
  holdMs: number;
}

export const DEFAULT_SPEAKING: SpeakingOptions = { threshold: 0.02, holdMs: 400 };

export const INITIAL_SPEAKING_STATE: SpeakingState = { speaking: false, lastLoudAt: 0 };

/**
 * Advance the detector by one capture frame.
 *
 * Asymmetric on purpose: speech starts the instant a frame is loud enough, so
 * the indicator feels immediate, and stops only after `holdMs` of quiet, so it
 * does not flicker between syllables. The caller sends a `voice_speaking`
 * message only when `speaking` actually flips — at 50 frames a second,
 * reporting every frame would be a message storm for a boolean.
 */
export function nextSpeakingState(
  prev: SpeakingState,
  energy: number,
  now: number,
  opts: SpeakingOptions = DEFAULT_SPEAKING,
): SpeakingState {
  if (energy > opts.threshold) return { speaking: true, lastLoudAt: now };
  if (!prev.speaking) return prev;
  if (now - prev.lastLoudAt >= opts.holdMs) return { speaking: false, lastLoudAt: prev.lastLoudAt };
  return prev;
}
