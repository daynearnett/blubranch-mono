// Views vs. Applicants trend for the employer analytics dashboard.
// Cumulative counts over the posting's lifetime on a shared Y-scale, so the
// gap between the two lines reads as the view→apply funnel. Pure react-native-svg
// (no chart lib).
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import type { JobStatsPoint } from '../lib/api.js';
import { colors, spacing, typography } from '../theme.js';

const VIEWS_COLOR = colors.navy; // Workwear Denim
const APPLICANTS_COLOR = colors.orangeWarm; // Amber — readable line on white

const HEIGHT = 180;
const PAD = { top: 14, right: 14, bottom: 26, left: 30 };

function fmtDay(iso: string): string {
  // iso is YYYY-MM-DD; render M/D without timezone drift.
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export function JobStatsChart({
  series,
  width,
}: {
  series: JobStatsPoint[];
  width: number;
}) {
  const geom = useMemo(() => {
    const plotW = Math.max(1, width - PAD.left - PAD.right);
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const n = series.length;
    const maxVal = Math.max(1, ...series.map((p) => p.views), ...series.map((p) => p.applicants));

    const x = (i: number) => PAD.left + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
    const y = (v: number) => PAD.top + plotH - (plotH * v) / maxVal;

    const toPoints = (key: 'views' | 'applicants') =>
      series.map((p, i) => `${x(i)},${y(p[key])}`).join(' ');

    return {
      plotW,
      plotH,
      maxVal,
      x,
      y,
      viewsPts: toPoints('views'),
      applicantsPts: toPoints('applicants'),
      baselineY: PAD.top + plotH,
      midVal: Math.round(maxVal / 2),
    };
  }, [series, width]);

  if (series.length < 2) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Not enough activity yet — this trend fills in over the first few days.
        </Text>
      </View>
    );
  }

  const first = series[0]!;
  const last = series[series.length - 1]!;

  return (
    <View>
      <Svg width={width} height={HEIGHT}>
        {/* Y gridlines + labels: 0, mid, max */}
        {[0, geom.midVal, geom.maxVal].map((v) => (
          <Line
            key={`grid-${v}`}
            x1={PAD.left}
            y1={geom.y(v)}
            x2={width - PAD.right}
            y2={geom.y(v)}
            stroke={colors.borderSoft}
            strokeWidth={1}
          />
        ))}
        {[0, geom.midVal, geom.maxVal].map((v) => (
          <SvgText
            key={`ylabel-${v}`}
            x={PAD.left - 6}
            y={geom.y(v) + 3}
            fontSize={9}
            fill={colors.textSecondary}
            textAnchor="end"
          >
            {String(v)}
          </SvgText>
        ))}

        {/* X labels: first + last day */}
        <SvgText
          x={geom.x(0)}
          y={HEIGHT - 8}
          fontSize={9}
          fill={colors.textSecondary}
          textAnchor="start"
        >
          {fmtDay(first.date)}
        </SvgText>
        <SvgText
          x={geom.x(series.length - 1)}
          y={HEIGHT - 8}
          fontSize={9}
          fill={colors.textSecondary}
          textAnchor="end"
        >
          {fmtDay(last.date)}
        </SvgText>

        {/* Lines */}
        <Polyline
          points={geom.viewsPts}
          fill="none"
          stroke={VIEWS_COLOR}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Polyline
          points={geom.applicantsPts}
          fill="none"
          stroke={APPLICANTS_COLOR}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Endpoint dots */}
        <Circle cx={geom.x(series.length - 1)} cy={geom.y(last.views)} r={3.5} fill={VIEWS_COLOR} />
        <Circle
          cx={geom.x(series.length - 1)}
          cy={geom.y(last.applicants)}
          r={3.5}
          fill={APPLICANTS_COLOR}
        />
      </Svg>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: VIEWS_COLOR }]} />
          <Text style={styles.legendText}>Views ({last.views})</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: APPLICANTS_COLOR }]} />
          <Text style={styles.legendText}>Applicants ({last.applicants})</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: spacing.lg, paddingHorizontal: spacing.sm },
  emptyText: { ...typography.small, color: colors.textSecondary, textAlign: 'center' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.small, color: colors.textPrimary },
});
