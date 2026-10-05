/**
 * InfoTip.tsx — reusable ⓘ glossary tooltip for S&C terminology.
 *
 * Tap the icon, get a plain-language card; tap outside or use Close to dismiss.
 * RN core only (Modal with animationType="none"), no positioning math —
 * a centered card never clips inside ScrollViews or nav strips.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { palette } from '../state/useStore';
import { theme } from '../theme/theme';

const colors = palette ?? {
  bg: '#000',
  surface: '#15151A',
  line: '#26262E',
  text: '#F4F4F6',
  dim: '#86868F',
  green: '#2EE6A8',
  amber: '#FFB454',
  red: '#FF5D5D',
};

import {
  GLOSSARY_ENTRIES,
  getGlossaryEntry,
  type GlossaryEntry,
} from '../data/glossary';

/** The canonical glossary map — single source of tooltip copy. Kept for backwards compatibility. */
export const GLOSSARY: Record<string, string> = Object.freeze(
  GLOSSARY_ENTRIES.reduce<Record<string, string>>(
    (acc, entry) => {
      acc[entry.id] = entry.definition;
      acc[entry.term] = entry.definition;
      if (entry.aliases) {
        for (const alias of entry.aliases) {
          acc[alias.toUpperCase()] = entry.definition;
          acc[alias] = entry.definition;
        }
      }
      return acc;
    },
    {
      'MACRO-CYCLE':
        GLOSSARY_ENTRIES.find((e) => e.id === 'MACROCYCLE')?.definition ?? '',
    },
  ),
);

export interface InfoTipProps {
  /** Glossary key, term, or alias; the card shows the canonical term as its title. */
  term: string;
}

export default function InfoTip({ term }: InfoTipProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false);
  const titleRef = useRef<React.ElementRef<typeof Text>>(null);
  const close = useCallback(() => setOpen(false), []);
  const focusExplanation = useCallback(() => {
    const titleHandle = findNodeHandle(titleRef.current);
    if (titleHandle !== null) {
      AccessibilityInfo.setAccessibilityFocus(titleHandle);
    }
  }, []);
  const entry = getGlossaryEntry(term);

  if (!entry) {
    const isDev =
      typeof __DEV__ !== 'undefined'
        ? __DEV__
        : process.env.NODE_ENV !== 'production';
    if (isDev) {
      throw new Error(`InfoTip: unknown glossary term "${term}"`);
    }
    return null;
  }

  const title = entry.term;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`What does ${title} mean?`}
        style={styles.trigger}
      >
        <View style={styles.icon}>
          <Text style={styles.iconText}>i</Text>
        </View>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={close}
        onShow={focusExplanation}
      >
        <View
          testID="info-tip-dialog"
          style={styles.backdrop}
          accessibilityViewIsModal
          onAccessibilityEscape={close}
        >
          <Pressable
            testID="info-tip-backdrop"
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessible={false}
            importantForAccessibility="no"
          />
          <View style={styles.card}>
            <Text ref={titleRef} accessible accessibilityRole="header" style={styles.cardTerm}>
              {title}
            </Text>
            <Text accessible style={styles.cardBody}>{entry.definition}</Text>
            <Text accessible style={styles.cardHint}>Tap outside or use Close to return.</Text>
            <Pressable
              style={styles.closeButton}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Dismiss explanation"
            >
              <Text style={styles.closeButtonText}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Reserve the full touch target in layout; hitSlop can be clipped by parents.
  trigger: {
    minWidth: theme.touch.min,
    minHeight: theme.touch.min,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.dim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: colors.dim, fontSize: 11, fontWeight: '800', fontStyle: 'italic' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    maxWidth: 360,
    gap: 8,
  },
  cardTerm: { color: colors.green, fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  cardBody: { color: colors.text, fontSize: 15, lineHeight: 22 },
  cardHint: { color: colors.dim, fontSize: 12, marginTop: 4 },
  closeButton: {
    minHeight: theme.touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 8,
  },
  closeButtonText: { color: colors.text, fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
});
