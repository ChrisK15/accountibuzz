import { useState } from 'react';
import {
  TextInput as RNTextInput,
  View,
  Text,
  type TextInputProps as RNTextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/useTheme';
import { FormLabel } from './FormLabel';

interface Props {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  helper?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: RNTextInputProps['autoCapitalize'];
  autoComplete?: RNTextInputProps['autoComplete'];
  keyboardType?: RNTextInputProps['keyboardType'];
  textContentType?: RNTextInputProps['textContentType'];
  returnKeyType?: RNTextInputProps['returnKeyType'];
  onSubmitEditing?: RNTextInputProps['onSubmitEditing'];
  style?: ViewStyle;
}

export function TextInput({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  helper,
  disabled,
  accessibilityLabel,
  secureTextEntry,
  autoCapitalize,
  autoComplete,
  keyboardType,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  style,
}: Props) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? t.colors.destructive
    : focused && !disabled
      ? t.colors.accent
      : t.colors.border;
  const borderWidth = focused && !disabled && !error ? 2 : error ? 2 : 1;
  const backgroundColor = disabled ? t.colors.surfaceMuted : t.colors.surface;
  const textColor = disabled ? t.colors.textMuted : t.colors.text;

  return (
    <View style={[{ width: '100%' }, style]}>
      {label ? <FormLabel>{label}</FormLabel> : null}
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={t.colors.textMuted}
        accessibilityLabel={accessibilityLabel ?? label}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        textContentType={textContentType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={[
          t.fonts.body,
          {
            color: textColor,
            backgroundColor,
            borderColor,
            borderWidth,
            borderRadius: t.radii.md,
            minHeight: 48,
            paddingHorizontal: t.spacing.md,
            paddingVertical: t.spacing.sm,
          },
        ]}
      />
      {error ? (
        <Text
          style={[
            t.fonts.caption,
            { color: t.colors.destructive, marginTop: t.spacing.xs },
          ]}
        >
          {error}
        </Text>
      ) : helper ? (
        <Text
          style={[
            t.fonts.caption,
            { color: t.colors.textMuted, marginTop: t.spacing.xs },
          ]}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
