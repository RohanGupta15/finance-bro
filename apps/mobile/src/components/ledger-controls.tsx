import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { SlideInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Icon, type IconName } from './icon';
import { ThemedText } from './themed-text';
import { Fonts, Motion, Radius, Spacing, Type } from '@/constants/theme';
import { getLedger } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { indiaDate, money } from '@/utils/display';
import { ease, fadeIn } from '@/utils/motion';


export function LedgerButton({ label, onPress, disabled = false, primary = false, selected, expanded, icon, iconOnly = false }: {
  label: string; onPress: () => void; disabled?: boolean; primary?: boolean; selected?: boolean; expanded?: boolean;
  icon?: IconName; iconOnly?: boolean;
}) {
  const colors = useTheme();
  const ink = primary ? colors.onAccent : selected ? colors.background : colors.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, ...(selected !== undefined && { selected }), ...(expanded !== undefined && { expanded }) }}
    aria-pressed={selected} aria-expanded={expanded} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, iconOnly && styles.iconButton, {
      borderColor: colors.border, backgroundColor: primary ? colors.accent : selected ? colors.fill : colors.backgroundElement,
      opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed && !disabled ? 0.96 : 1 }],
    }]}>
    {icon ? <Icon name={icon} size={20} color={ink} /> : null}
    {iconOnly ? null : <ThemedText style={[Type.body, { fontFamily: Fonts.sansSemiBold, color: ink }]}>{label}</ThemedText>}
  </Pressable>;
}

/** Two or three choices with an ink thumb that slides between them. */
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: readonly { value: T; label: string; icon?: IconName }[]; value: T; onChange: (value: T) => void; label: string;
}) {
  const colors = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segment = width ? (width - 8) / options.length : 0;
  const x = useSharedValue(index * segment);
  useEffect(() => {
    // withTiming jumps straight to the end when the system asks for reduced motion.
    x.value = withTiming(index * segment, { duration: Motion.standard, easing: ease });
  }, [index, segment, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <View accessibilityRole="radiogroup" accessibilityLabel={label}
    onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
    style={[styles.segment, { borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
    {segment ? <Animated.View style={[styles.thumb, { width: segment, backgroundColor: colors.fill }, thumb]} /> : null}
    {options.map((option) => {
      const on = option.value === value;
      const ink = on ? colors.background : colors.text;
      return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on}
        onPress={() => {
          if (on) return;
          void Haptics.selectionAsync().catch(() => {});
          onChange(option.value);
        }} style={styles.segmentItem}>
        {option.icon ? <Icon name={option.icon} size={18} color={ink} /> : null}
        <ThemedText style={[Type.rowTitle, { color: ink }]} numberOfLines={1}>{option.label}</ThemedText>
      </Pressable>;
    })}
  </View>;
}

type MonthRow = { month: string; expensePaise: number; entryCount: number };

function monthName(month: string, withYear: boolean) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', ...(withYear && { year: 'numeric' }), timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));
}

/**
 * The month as a control. `title` is the screen heading itself; `pill` sits beside a heading.
 * Opens a sheet listing the months that hold entries, newest first, with what each spent.
 */
export function MonthPicker({ month, onChange, variant = 'pill' }: {
  month: string; onChange: (month: string) => void; variant?: 'title' | 'pill';
}) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState<MonthRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const current = indiaDate().slice(0, 7);
  const showYear = month.slice(0, 4) !== current.slice(0, 4);
  const label = monthName(month, showYear);

  const show = useCallback(() => {
    setOpen(true); setFailed(false);
    getLedger().then((ledger) => ledger.listEntryMonths()).then((rows) => {
      // The month on screen stays listed even before it has entries, so the list always contains "here".
      setMonths(rows.some((row) => row.month === month) ? rows
        : [...rows, { month, expensePaise: 0, entryCount: 0 }].sort((left, right) => (left.month < right.month ? 1 : -1)));
    }).catch(() => setFailed(true));
  }, [month]);

  const trigger = variant === 'title'
    ? <Pressable accessibilityRole="button" accessibilityLabel={`${label}. Choose month`} onPress={show}
      style={({ pressed }) => [styles.titleTrigger, { opacity: pressed ? 0.6 : 1 }]}>
      <ThemedText style={Type.screenTitle} numberOfLines={1}>{label}</ThemedText>
      <Icon name="expand" size={26} color={colors.text} />
    </Pressable>
    : <Pressable accessibilityRole="button" accessibilityLabel={`${label}. Choose month`} onPress={show}
      style={({ pressed }) => [styles.button, styles.monthPill, { backgroundColor: colors.backgroundElement, borderColor: colors.border, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      <ThemedText style={{ ...Type.body, fontFamily: Fonts.sansHeavy }}>{label}</ThemedText>
      <Icon name="expand" size={18} color={colors.text} />
    </Pressable>;

  return <>
    {trigger}
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setOpen(false)}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close month list" style={[styles.backdrop, { backgroundColor: colors.scrim }]} onPress={() => setOpen(false)} />
      <Animated.View entering={SlideInDown.duration(Motion.standard).easing(ease)}
        style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.grabber, { backgroundColor: colors.textMuted }]} />
        <ThemedText style={[Type.sectionTitle, styles.sheetTitle]} accessibilityRole="header">Choose month</ThemedText>
        {failed ? <ThemedText style={[Type.note, styles.sheetTitle, { color: colors.over }]} accessibilityRole="alert">Couldn’t load months. Close and try again.</ThemedText> : null}
        <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetContent}>
          {(months ?? []).map((row, index) => {
            const selected = row.month === month;
            return <Animated.View key={row.month} entering={fadeIn(Math.min(index, 8) * 30)}>
              <Pressable accessibilityRole="button" accessibilityState={{ selected }}
                accessibilityLabel={`${monthName(row.month, true)}, ${money(row.expensePaise)} spent, ${row.entryCount} ${row.entryCount === 1 ? 'entry' : 'entries'}${row.month === current ? ', this month' : ''}`}
                onPress={() => { setOpen(false); if (!selected) onChange(row.month); }}
                style={({ pressed }) => [styles.monthRow, { backgroundColor: selected ? colors.fill : pressed ? colors.backgroundSelected : 'transparent' }]}>
                <View style={styles.monthWords}>
                  <ThemedText style={[Type.rowTitle, { color: selected ? colors.background : colors.text }]}>{monthName(row.month, row.month.slice(0, 4) !== current.slice(0, 4))}</ThemedText>
                  <ThemedText style={[Type.label, { color: selected ? colors.background : colors.textSecondary }]}>
                    {row.month === current ? 'This month · ' : ''}{row.entryCount} {row.entryCount === 1 ? 'entry' : 'entries'}
                  </ThemedText>
                </View>
                <ThemedText style={[Type.amountSmall, { color: selected ? colors.background : colors.text }]}>{money(row.expensePaise)}</ThemedText>
                {selected ? <Icon name="check" size={20} color={colors.background} /> : <View style={styles.checkSpace} />}
              </Pressable>
            </Animated.View>;
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  button: { minHeight: 44, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, flexDirection: 'row', gap: 8,
    borderWidth: 2, borderRadius: Radius.pill, justifyContent: 'center', alignItems: 'center' },
  iconButton: { width: 44, paddingHorizontal: 0 },
  monthPill: { gap: 6 },
  titleTrigger: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start' },
  segment: { flexDirection: 'row', borderWidth: 2, borderRadius: Radius.pill, padding: 2, minHeight: 44 },
  thumb: { position: 'absolute', top: 2, bottom: 2, left: 2, borderRadius: Radius.pill },
  segmentItem: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, minHeight: 40 },
  backdrop: StyleSheet.absoluteFill,
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '75%', borderTopLeftRadius: Radius.hero, borderTopRightRadius: Radius.hero, borderWidth: 2, borderBottomWidth: 0, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, opacity: 0.5 },
  sheetTitle: { paddingHorizontal: Spacing.gutter, paddingTop: 14, paddingBottom: 8 },
  sheetList: { flexGrow: 0 },
  sheetContent: { paddingHorizontal: 12, gap: 2 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 12, borderRadius: Radius.control },
  monthWords: { flex: 1, gap: 2 },
  checkSpace: { width: 20 },
});
