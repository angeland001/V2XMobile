import * as Speech from 'expo-speech';
import { NativeModules, Platform } from 'react-native';

// Native module (VoiceGuidanceModule.kt, Android only) that plays through
// the navigation-guidance audio channel Android Auto expects from a
// NAVIGATION-category car app. Plain expo-speech plays on the ordinary
// media stream, which AAOS suppresses for anything but that channel once a
// car session is connected — that's why preemption/turn-by-turn cues went
// silent on the phone the moment Android Auto connected. Undefined in Expo
// Go or on iOS, where announce()/stop() fall back to expo-speech below.
const { VoiceGuidance } = NativeModules;

// Settings' voice picker shows at most this many voices — see
// getAvailableVoices below. en-us-x-tpc-network is pinned first per explicit
// preference; the rest are a priority list of known Android/Google TTS
// en-US "network" (WaveNet-quality) voice identifiers chosen to span
// different underlying speakers, so the shortlist reads as a genuine variety
// rather than several near-identical takes on the same one.
const CURATED_VOICE_IDS = [
  'en-us-x-tpc-network',
  'en-us-x-sfg-network',
  'en-us-x-tpd-network',
  'en-us-x-iol-network',
  'en-us-x-iom-network',
  'en-us-x-iog-network',
];
const MAX_CURATED_VOICES = 6;

// Selected TTS voice identifier, applied to every announce() call app-wide
// (turn-by-turn guidance and preemption cues alike — one phone voice, not a
// different one per feature). null means the device's own default voice for
// the given language. Set centrally from SettingsViewModel.voiceIdentifier
// (see the reaction in MainViewModel's constructor) rather than threaded as
// a parameter through every call site, since most callers (RouteViewModel's
// turn-by-turn announcements in particular) have no reason to otherwise know
// about settings at all.
let activeVoiceId: string | null = null;

export const VoiceGuidanceService = {
  announce(text: string): void {
    if (Platform.OS === 'android' && VoiceGuidance?.announce) {
      try {
        VoiceGuidance.announce(text, activeVoiceId);
        return;
      } catch {
        // Fall through to expo-speech below.
      }
    }
    try {
      Speech.stop();
      Speech.speak(text, { language: 'en-US', rate: 0.9, voice: activeVoiceId ?? undefined });
    } catch {
      // Silent — Speech unavailable in some emulator configs
    }
  },

  stop(): void {
    if (Platform.OS === 'android' && VoiceGuidance?.stop) {
      try {
        VoiceGuidance.stop();
      } catch {
        // Silent
      }
    }
    try {
      Speech.stop();
    } catch {
      // Silent
    }
  },

  setVoice(identifier: string | null): void {
    activeVoiceId = identifier;
  },

  getVoice(): string | null {
    return activeVoiceId;
  },

  // English-only: this app's spoken cues are all English text, and an
  // unfiltered device voice list can run into the dozens once every
  // installed language pack is counted — nothing a driver picking "which
  // voice reads my alerts" would want to wade through.
  //
  // Falls back to the unfiltered list if the English filter would leave
  // nothing: plenty of Android phones only have voice data downloaded for
  // one locale total (fresh Pixels included — nothing extra until the user
  // downloads more packs via system TTS settings), so on a device with only
  // a single installed voice whose language tag doesn't happen to read as
  // "en", showing nothing would be worse than showing that one real option.
  //
  // Retries once after a short delay if the first pass comes back completely
  // empty. expo-speech's Android module lazily constructs its TextToSpeech
  // instance on first use and reads .voices synchronously right after
  // construction, before the engine's own async onInit has necessarily
  // fired — so the very first call to this in the app's process (e.g. a
  // fresh install where Settings is the first screen visited, before any
  // announce() has already warmed the engine up) can legitimately race and
  // come back empty even though the device has real voices installed. A
  // second attempt ~400ms later almost always lands after onInit resolves.
  //
  // Curated down to CURATED_VOICE_IDS below on top of the English filter —
  // even just en-US on a Google TTS install runs to a few dozen
  // near-identical local/network quality variants per underlying speaker,
  // which is worse than showing nothing for a picker meant to be "which
  // voice", not "which of 30 near-duplicates".
  async getAvailableVoices(): Promise<Speech.Voice[]> {
    const fetchOnce = async (): Promise<Speech.Voice[]> => {
      try {
        return await Speech.getAvailableVoicesAsync();
      } catch {
        return [];
      }
    };

    let voices = await fetchOnce();
    if (voices.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      voices = await fetchOnce();
    }

    const english = voices.filter((v) => v.language?.toLowerCase().startsWith('en'));
    const pool = english.length > 0 ? english : voices;
    const sorted = [...pool].sort((a, b) => a.name.localeCompare(b.name));

    const byId = new Map(sorted.map((v) => [v.identifier, v] as const));
    const curated: Speech.Voice[] = [];
    for (const id of CURATED_VOICE_IDS) {
      const v = byId.get(id);
      if (v) curated.push(v);
    }
    // None of the curated identifiers matched (a non-Google TTS engine, or
    // one using different naming) — fall back to the plain sorted list
    // rather than showing an empty picker.
    if (curated.length === 0) return sorted.slice(0, MAX_CURATED_VOICES);

    for (const v of sorted) {
      if (curated.length >= MAX_CURATED_VOICES) break;
      if (!curated.includes(v)) curated.push(v);
    }
    return curated;
  },

  // Fire-and-forget: touches the TTS engine as early in the app's lifecycle
  // as possible (see the race condition explained on getAvailableVoices
  // above) so it's typically already initialized by the time the user ever
  // opens the Voice picker, instead of relying on that call's own retry to
  // paper over a cold start. Safe to call multiple times — the underlying
  // native TextToSpeech instance is a lazily-created singleton.
  warmUp(): void {
    Speech.getAvailableVoicesAsync().catch(() => {});
  },

  // Lets a settings screen play a sample in a candidate voice without
  // changing the actual active selection — announce() always uses
  // activeVoiceId, this always uses whatever's passed in.
  preview(voiceId: string | null): void {
    try {
      Speech.stop();
      Speech.speak('This is a preview of this voice.', { language: 'en-US', rate: 0.9, voice: voiceId ?? undefined });
    } catch {
      // Silent
    }
  },
};
