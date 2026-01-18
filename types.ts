
export enum VoiceName {
  Kore = 'Kore',
  Puck = 'Puck',
  Charon = 'Charon',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
}

export interface VoiceOption {
  id: VoiceName;
  name: string;
  description: string;
  gender: 'Male' | 'Female';
}

export interface AudioState {
  isProcessing: boolean;
  isPlaying: boolean;
  error: string | null;
  audioBuffer: AudioBuffer | null;
  progress?: {
    current: number;
    total: number;
  };
}
