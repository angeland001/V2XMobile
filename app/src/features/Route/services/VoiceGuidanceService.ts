import * as Speech from 'expo-speech';

export const VoiceGuidanceService = {
  announce(text: string): void {
    try {
      Speech.stop();
      Speech.speak(text, { language: 'en-US', rate: 0.9 });
    } catch {
      // Silent — Speech unavailable in some emulator configs
    }
  },

  stop(): void {
    try {
      Speech.stop();
    } catch {
      // Silent
    }
  },
};
