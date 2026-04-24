// IanaTimezonePicker — full-screen modal with search + FlatList + static-fallback safety.
// Spec: 02-UI-SPEC.md §"IanaTimezonePicker" (lines 378-379), §"Copywriting Contract"
// (empty-state copy line 232), 02-RESEARCH.md §Pitfall 4 (Hermes iOS Intl fallback).
//
// Invariants:
//   • `listTimezones()` is called lazily (on first render when visible) so the
//     Intl / STATIC_FALLBACK branch is exercised per the plan-03 contract.
//   • Search filters by substring match against EITHER iana OR humanized label.
//   • Row tap → `onSelect(iana)` with the exact IANA string (NOT the label).
//   • Empty search copy is EXACTLY: 'No match. Try another city or region.'
//   • iOS: presentationStyle="pageSheet"; Android: standard modal.

import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal as RNModal,
  Pressable,
  SafeAreaView,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { labelFor, listTimezones } from './timezones';
import { useTheme } from '../../theme/useTheme';

export interface IanaTimezonePickerProps {
  visible: boolean;
  initialValue?: string;
  onSelect: (iana: string) => void;
  onDismiss: () => void;
}

interface TzEntry {
  iana: string;
  label: string;
}

export function IanaTimezonePicker({
  visible,
  initialValue,
  onSelect,
  onDismiss,
}: IanaTimezonePickerProps) {
  const t = useTheme();
  const [query, setQuery] = useState('');

  // Lazy: compute the list+labels once per mount. The Intl/fallback decision
  // is inside listTimezones() per plan-03 contract.
  const entries = useMemo<TzEntry[]>(() => {
    const zones = listTimezones();
    return zones.map((iana) => ({ iana, label: labelFor(iana) }));
  }, []);

  const filtered = useMemo<TzEntry[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.iana.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q),
    );
  }, [entries, query]);

  return (
    <RNModal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: t.colors.background }}
        accessibilityViewIsModal
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: t.spacing.xl,
            paddingVertical: t.spacing.md,
          }}
        >
          <Pressable
            onPress={onDismiss}
            accessibilityLabel="Close"
            accessibilityRole="button"
            hitSlop={8}
          >
            <Feather name="x" size={24} color={t.colors.textStrong} />
          </Pressable>
          <Text
            accessibilityRole="header"
            style={[t.fonts.heading2, { color: t.colors.textStrong }]}
          >
            Pick a timezone
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={{ paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing.md }}>
          <RNTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search cities or regions"
            placeholderTextColor={t.colors.textMuted}
            accessibilityLabel="Search timezones"
            autoCorrect={false}
            autoCapitalize="none"
            style={[
              t.fonts.body,
              {
                backgroundColor: t.colors.surfaceMuted,
                borderRadius: t.radii.md,
                paddingHorizontal: t.spacing.md,
                paddingVertical: t.spacing.md,
                color: t.colors.textStrong,
                minHeight: 44,
              },
            ]}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.iana}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item.iana)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={({ pressed }) => ({
                paddingHorizontal: t.spacing.xl,
                paddingVertical: t.spacing.md,
                backgroundColor: pressed
                  ? t.colors.surfaceMuted
                  : 'transparent',
              })}
            >
              <Text
                style={[
                  t.fonts.body,
                  {
                    color: t.colors.textStrong,
                    fontWeight: item.iana === initialValue ? '700' : '500',
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text
              style={[
                t.fonts.body,
                {
                  textAlign: 'center',
                  padding: t.spacing.xl,
                  color: t.colors.textMuted,
                },
              ]}
            >
              No match. Try another city or region.
            </Text>
          }
          initialNumToRender={30}
          windowSize={10}
          keyboardShouldPersistTaps="handled"
        />
      </SafeAreaView>
    </RNModal>
  );
}
