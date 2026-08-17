// The app's design language — an engineering-plan-sheet aesthetic (road
// authority drawings, hairline rules, ink-on-paper) rather than a generic
// app-template look, in keeping with V2XMobile listening to live roadside
// DSRC/C-V2X broadcasts (TIM messages, signal-preemption zones) as it
// drives. Originated on the Route tab (search/preview) and now shared by
// Alerts, Settings, and the tab bar. The Map tab's live-driving HUD
// (NavigationBanner, NavigationSummaryBar, MapLegend, PreemptionStatusBanner,
// etc.) is a separate, not-yet-migrated pass — it still reads from
// features/UI/theme.ts (COLORS) and its own local hardcoded colors.
//
// Two amber tokens on purpose: `amber` is the bright, saturated fill used
// for buttons/dots/borders (reads correctly with dark `ink` text on top of
// it, or as a small graphical marker); `amberText` is a deeper variant for
// anywhere amber is the text/icon color sitting directly on a light
// background, where the bright fill value alone fails contrast.

export const ROUTE_COLORS = {
  bg:           '#F6F4EE',
  panel:        '#FFFFFF',
  panelRaised:  '#FCFBF6',

  ink:          '#1B1D22',

  amber:        '#F2A61A',
  amberText:    '#9A5B0A',
  amberDim:     'rgba(242, 166, 26, 0.14)',
  amberBorder:  'rgba(242, 166, 26, 0.45)',

  signal:       '#0F8B82',
  signalDim:    'rgba(15, 139, 130, 0.10)',

  danger:       '#C2321F',
  dangerDim:    'rgba(194, 50, 31, 0.10)',

  preempt:      '#6D3FC2',
  preemptDim:   'rgba(109, 63, 194, 0.10)',

  steel:        '#6B7280',
  steelDim:     '#A8ACB6',
  hairline:     'rgba(27, 29, 34, 0.12)',

  white:        '#FFFFFF',
} as const;

export const ROUTE_FONTS = {
  displayBlack:     'Overpass_900Black',
  displayExtraBold: 'Overpass_800ExtraBold',
  displayBold:      'Overpass_700Bold',
  displaySemiBold:  'Overpass_600SemiBold',

  body:       'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodySemiBold: 'IBMPlexSans_600SemiBold',

  mono:       'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

// Single source of truth for TIM category → color, used by RouteZoneStrip,
// RoutePreviewSheet, RoutePreviewMapScreen, and AlertsScreen — all three
// represent the exact same three categories (safety/regulatory/
// informational) and previously each hardcoded their own slightly-different
// mapping. Matches the red/yellow/blue scheme MapView.tsx's TIMLayer
// already uses on the live-driving map (TIM_CATEGORY_STYLES there) rather
// than deriving from ROUTE_COLORS' danger/amberText/signal tokens, so a
// zone reads identically whether you're previewing the route or already
// navigating it.
export const TIM_CATEGORY_STYLE = {
  safety:        { color: '#EF4444', dimColor: 'rgba(239, 68, 68, 0.12)',  icon: 'warning' as const,            label: 'Safety' },
  regulatory:    { color: '#F59E0B', dimColor: 'rgba(245, 158, 11, 0.12)', icon: 'ban' as const,                label: 'Regulatory' },
  informational: { color: '#3B82F6', dimColor: 'rgba(59, 130, 246, 0.12)', icon: 'information-circle' as const, label: 'Info' },
} as const;

export default ROUTE_COLORS;
