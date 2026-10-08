import { Tabs } from 'expo-router';
import type { ComponentRef, Ref } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The Android material bar cannot float; keep the reference capsule with Router's standard tabs. */
export default function AppTabs() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const capsuleWidth = Math.min(520, width - 32);
  const capsuleInset = (width - capsuleWidth) / 2;
  return <Tabs screenOptions={({ route }) => ({ headerShown: false, animation: 'none',
    tabBarActiveTintColor: colors.text, tabBarInactiveTintColor: colors.tabText,
    tabBarActiveBackgroundColor: colors.tabSelected,
    tabBarLabelStyle: { fontFamily: Fonts.sansSemiBold, fontSize: 11, marginTop: 2 },
    tabBarItemStyle: { borderRadius: 999 },
    tabBarButton: (props) => <Pressable {...props} ref={props.ref as Ref<ComponentRef<typeof Pressable>>}
      style={[props.style, { borderRadius: 999, overflow: 'hidden', justifyContent: 'center', paddingVertical: 2 }]} />,
    tabBarStyle: { position: 'absolute', width: capsuleWidth, start: capsuleInset, end: capsuleInset, bottom: insets.bottom + 24, height: 64,
      padding: 5, paddingBottom: 5, paddingTop: 5, borderRadius: 999, borderWidth: 1, borderTopWidth: 1,
      borderColor: colors.tabBarBorder, backgroundColor: colors.backgroundElement, elevation: 0,
      ...(route.name === 'index' && (route.params as { _entryOpen?: string } | undefined)?._entryOpen === '1' ? { display: 'none' as const } : {}) },
  })}>
    {(['index', 'budgets', 'insights', 'settings'] as const).map((name, index) => <Tabs.Screen key={name} name={name}
      options={{ title: ['Home', 'Budgets', 'Insights', 'Settings'][index],
        tabBarIcon: ({ color }) => <TabIcon name={name} color={color ?? colors.text} /> }} />)}
  </Tabs>;
}

function TabIcon({ name, color }: { name: string; color: ColorValue }) {
  const stroke = { borderColor: color, borderWidth: 2 };
  return <View style={styles.icon} accessible={false}>
    {name === 'index' ? <><View style={[styles.sheet, stroke]} /><View style={[styles.backSheet, { borderTopColor: color, borderRightColor: color }]} /></> : null}
    {name === 'budgets' ? <View style={styles.dots}>{[0, 1, 2].map((key) => <View key={key} style={[styles.dot, stroke]} />)}</View> : null}
    {name === 'insights' ? <><View style={[styles.baseline, { backgroundColor: color }]} />{[8, 16, 12].map((height, index) => <View key={index} style={{ position: 'absolute', bottom: 5, left: 4 + index * 6, width: 2, height, borderRadius: 1, backgroundColor: color }} />)}</> : null}
    {name === 'settings' ? <>{[5, 17].map((top, index) => <View key={top} style={[styles.slider, { top, backgroundColor: color }]}><View style={[styles.knob, stroke, { left: index === 0 ? 12 : 4 }]} /></View>)}</> : null}
  </View>;
}
const styles = StyleSheet.create({
  icon: { width: 24, height: 24 }, sheet: { position: 'absolute', left: 5, top: 5, width: 12, height: 16, borderRadius: 2 },
  backSheet: { position: 'absolute', left: 9, top: 2, width: 12, height: 16, borderTopWidth: 2, borderRightWidth: 2, borderRadius: 2 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }, dot: { width: 6, height: 6, borderRadius: 3 },
  baseline: { position: 'absolute', bottom: 2, left: 2, right: 2, height: 2, borderRadius: 1 },
  slider: { position: 'absolute', left: 2, right: 2, height: 2, borderRadius: 1 }, knob: { position: 'absolute', top: -2, width: 6, height: 6, borderRadius: 3 },
});
