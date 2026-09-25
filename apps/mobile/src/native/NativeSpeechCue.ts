import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  isAvailable(): Promise<boolean>;
  speak(text: string, utteranceId: string): Promise<void>;
  stop(): Promise<void>;
  readonly onSpeechEvent: CodegenTypes.EventEmitter<{
    type: string;
    utteranceId: string;
  }>;
}

export default TurboModuleRegistry.get<Spec>('NativeSpeechCue');
