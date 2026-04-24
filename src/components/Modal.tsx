// Modal — centered-sheet confirmation primitive.
// Spec: 02-UI-SPEC.md §"Component Additions" §3 Modal.
// Copywriting contract (02-UI-SPEC.md §"Dismiss-label rule"):
//   cancelLabel has NO default; the word 'Cancel' is banned. Dev-mode warns if supplied.

import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal as RNModal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface ModalAction {
  label: string;
  onPress: () => void;
  variant: 'primary' | 'destructive';
  loading?: boolean;
}

export interface ModalSecondaryAction {
  label: string;
  onPress: () => void;
  variant: 'destructive-text' | 'ghost';
}

export interface ModalProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  body: ReactNode;
  primaryAction: ModalAction;
  secondaryAction?: ModalSecondaryAction;
  cancelLabel: string; // REQUIRED; dev-warn if case-insensitive 'Cancel'
}

export function Modal({
  visible,
  onDismiss,
  title,
  body,
  primaryAction,
  secondaryAction,
  cancelLabel,
}: ModalProps) {
  const t = useTheme();

  // Dev-mode copywriting-contract enforcement (02-UI-SPEC.md).
  if (__DEV__ && cancelLabel.toLowerCase() === 'cancel') {
    // eslint-disable-next-line no-console
    console.warn(
      "[Modal] cancelLabel='Cancel' is banned by the P2 copywriting contract. " +
        "Provide a context-specific label like 'Stay in group' or 'Keep the group'.",
    );
  }

  const scrimBg =
    t.name === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)';

  const primaryIsDestructive = primaryAction.variant === 'destructive';
  const primaryBg = primaryIsDestructive
    ? t.colors.destructive
    : t.colors.primary;
  const primaryFg = primaryIsDestructive
    ? t.colors.primaryFg // light text on red
    : t.colors.primaryFg; // near-black on yellow
  const primaryTextColor = primaryIsDestructive ? '#FFFFFF' : t.colors.primaryFg;

  return (
    <RNModal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable
        testID="modal-scrim"
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: scrimBg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: t.spacing.xl,
        }}
      >
        <Pressable
          accessibilityViewIsModal
          onPress={() => {
            /* swallow — sheet taps must not dismiss */
          }}
          style={{
            width: '100%',
            maxWidth: 400,
            backgroundColor: t.colors.surface,
            borderRadius: t.radii.lg,
            padding: t.spacing.xl,
            borderWidth: t.name === 'dark' ? 1 : 0,
            borderColor: t.name === 'dark' ? t.colors.border : undefined,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            shadowOpacity: t.name === 'dark' ? 0 : 0.15,
            elevation: t.name === 'dark' ? 0 : 4,
          }}
        >
          <View style={{ gap: t.spacing.lg }}>
            <Text
              accessibilityRole="header"
              style={[
                t.fonts.heading2,
                { color: t.colors.textStrong, textAlign: 'center' },
              ]}
            >
              {title}
            </Text>
            <View>
              {typeof body === 'string' ? (
                <Text
                  style={[
                    t.fonts.body,
                    { color: t.colors.text, textAlign: 'center' },
                  ]}
                >
                  {body}
                </Text>
              ) : (
                body
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={primaryAction.label}
              accessibilityState={{
                disabled: !!primaryAction.loading,
                busy: !!primaryAction.loading,
              }}
              onPress={
                primaryAction.loading ? undefined : primaryAction.onPress
              }
              style={({ pressed }) => ({
                backgroundColor: primaryBg,
                borderRadius: t.radii.md,
                minHeight: 48,
                paddingHorizontal: t.spacing.lg,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: primaryAction.loading ? 0.5 : pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              {primaryAction.loading ? (
                <ActivityIndicator color={primaryFg} />
              ) : (
                <Text
                  style={[
                    t.fonts.body,
                    { color: primaryTextColor, fontWeight: '700' },
                  ]}
                >
                  {primaryAction.label}
                </Text>
              )}
            </Pressable>

            {secondaryAction ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={secondaryAction.label}
                onPress={secondaryAction.onPress}
                style={({ pressed }) => ({
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={[
                    t.fonts.body,
                    {
                      color:
                        secondaryAction.variant === 'destructive-text'
                          ? t.colors.destructive
                          : t.colors.text,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {secondaryAction.label}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              onPress={onDismiss}
              style={({ pressed }) => ({
                marginTop: t.spacing.lg,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={[
                  t.fonts.body,
                  { color: t.colors.textMuted, fontWeight: '500' },
                ]}
              >
                {cancelLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
