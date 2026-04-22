import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

export function ScreenContainer({ children, scroll, style, contentStyle }: Props) {
  const t = useTheme();
  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: t.colors.background,
  };
  const innerStyle: ViewStyle = {
    paddingHorizontal: t.spacing.xl,
    flexGrow: 1,
  };

  if (scroll) {
    return (
      <SafeAreaView style={[containerStyle, style]}>
        <ScrollView
          contentContainerStyle={[innerStyle, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[containerStyle, style]}>
      <View style={[innerStyle, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}
