import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  small: Type.note,
  smallBold: { ...Type.note, fontFamily: Fonts.sansSemiBold },
  default: Type.body,
  title: Type.screenTitle,
  subtitle: Type.sectionTitle,
  link: { ...Type.body, textDecorationLine: 'underline' },
  linkPrimary: { ...Type.body, fontFamily: Fonts.sansSemiBold, textDecorationLine: 'underline' },
  code: { ...Type.amountSmall, fontFamily: Fonts.mono },
});
