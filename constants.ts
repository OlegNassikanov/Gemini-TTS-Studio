
import { VoiceName, VoiceOption } from './types';

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: VoiceName.Kore, name: 'Kore', description: 'Deep and resonant', gender: 'Male' },
  { id: VoiceName.Puck, name: 'Puck', description: 'Cheerful and energetic', gender: 'Male' },
  { id: VoiceName.Charon, name: 'Charon', description: 'Calm and steady', gender: 'Male' },
  { id: VoiceName.Fenrir, name: 'Fenrir', description: 'Authoritative and strong', gender: 'Male' },
  { id: VoiceName.Zephyr, name: 'Zephyr', description: 'Soft and airy', gender: 'Female' },
];

export const SAMPLE_RATE = 24000;
