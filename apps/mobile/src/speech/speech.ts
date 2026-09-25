import { AppState, TurboModuleRegistry } from 'react-native';
import type { Spec } from '../native/NativeSpeechCue';

type Listener = (key: string | null) => void;
const listeners = new Set<Listener>();
let activeKey: string | null = null;
let activeId: string | null = null;
let sequence = 0;
let subscribedModule: Spec | null = null;
let eventSubscription: { remove(): void } | null = null;

const moduleOrNull = (): Spec | null => TurboModuleRegistry.get<Spec>('NativeSpeechCue');
const publish = (key: string | null): void => {
  activeKey = key;
  for (const listener of listeners) listener(key);
};

function watch(native: Spec): void {
  if (subscribedModule === native) return;
  eventSubscription?.remove();
  subscribedModule = native;
  eventSubscription = native.onSpeechEvent(({ type, utteranceId }) => {
    if (utteranceId !== activeId) return;
    if (type === 'done' || type === 'stopped' || type === 'error') {
      activeId = null;
      publish(null);
    }
  });
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(activeKey);
  return () => { listeners.delete(listener); };
}

export async function isSpeechAvailable(): Promise<boolean> {
  try {
    const native = moduleOrNull();
    return native !== null && await native.isAvailable();
  } catch {
    return false;
  }
}

export async function speak(key: string, text: string): Promise<boolean> {
  const request = ++sequence;
  try {
    const native = moduleOrNull();
    if (native === null || !await native.isAvailable() || request !== sequence) return false;
    watch(native);
    const id = String(request);
    activeId = id;
    publish(key);
    await native.speak(text, id);
    return request === sequence;
  } catch {
    if (request === sequence) {
      activeId = null;
      publish(null);
    }
    return false;
  }
}

export async function stop(key?: string): Promise<void> {
  if (key !== undefined && key !== activeKey) return;
  ++sequence;
  activeId = null;
  if (activeKey !== null) publish(null);
  try { await moduleOrNull()?.stop(); } catch { /* no native error reaches render */ }
}

AppState.addEventListener('change', (state) => {
  if (state !== 'active') void stop();
});
