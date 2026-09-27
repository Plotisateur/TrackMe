import { useMemo, useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/state/AppContext';
import { formatShortDate } from '@/utils/date';
import { T } from './ui';

export interface ChartPoint {
  t: number;
  value: number;
}

/** Minimal time-series line chart. Optional second series draws as a thicker overlay (e.g. a trend). */
export function LineChart({
  points,
  overlay,
  height = 160,
  format = (v) => v.toFixed(1),
  target,
  emptyText = 'Not enough data yet',
}: {
  points: ChartPoint[];
  overlay?: ChartPoint[];
  height?: number;
  format?: (v: number) => string;
  target?: number;
  emptyText?: string;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const geo = useMemo(() => {
    const all = [...points, ...(overlay ?? [])];
    if (all.length === 0 || width === 0) return null;
    const values = all.map((p) => p.value).concat(target !== undefined ? [target] : []);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (hi - lo < 1e-6) {
      lo -= 1;
      hi += 1;
    }
    const padY = (hi - lo) * 0.1;
    lo -= padY;
    hi += padY;
    const t0 = Math.min(...all.map((p) => p.t));
    const t1 = Math.max(...all.map((p) => p.t));
    const left = 44;
    const right = 8;
    const top = 8;
    const bottom = 22;
    const x = (t: number) =>
      t1 === t0
        ? (left + width - right) / 2
        : left + ((t - t0) / (t1 - t0)) * (width - left - right);
    const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (height - top - bottom);
    return { lo, hi, t0, t1, x, y, left, bottom };
  }, [points, overlay, width, height, target]);

  if (points.length === 0) {
    return (
      <View style={{ height: 60, justifyContent: 'center' }}>
        <T tone="faint">{emptyText}</T>
      </View>
    );
  }

  const label = `Chart with ${points.length} points, from ${format(points[0].value)} to ${format(points[points.length - 1].value)}`;

  return (
    <View onLayout={onLayout} style={{ height }} accessible accessibilityLabel={label}>
      {geo ? (
        <Svg width={width} height={height}>
          {[geo.lo, (geo.lo + geo.hi) / 2, geo.hi].map((v, i) => (
            <SvgText key={i} x={4} y={geo.y(v) + 4} fill={c.textFaint} fontSize={10}>
              {format(v)}
            </SvgText>
          ))}
          <Line
            x1={geo.left}
            x2={width - 8}
            y1={geo.y(geo.lo)}
            y2={geo.y(geo.lo)}
            stroke={c.border}
          />
          {target !== undefined ? (
            <Line
              x1={geo.left}
              x2={width - 8}
              y1={geo.y(target)}
              y2={geo.y(target)}
              stroke={c.info}
              strokeDasharray="4 4"
            />
          ) : null}
          <Polyline
            points={points.map((p) => `${geo.x(p.t)},${geo.y(p.value)}`).join(' ')}
            fill="none"
            stroke={overlay ? c.textFaint : c.primary}
            strokeWidth={overlay ? 1.5 : 2.5}
          />
          {points.map((p, i) => (
            <Circle
              key={i}
              cx={geo.x(p.t)}
              cy={geo.y(p.value)}
              r={overlay ? 2.5 : 3.5}
              fill={overlay ? c.textFaint : c.primary}
            />
          ))}
          {overlay && overlay.length > 1 ? (
            <Polyline
              points={overlay.map((p) => `${geo.x(p.t)},${geo.y(p.value)}`).join(' ')}
              fill="none"
              stroke={c.primary}
              strokeWidth={3}
            />
          ) : null}
          <SvgText x={geo.left} y={height - 6} fill={c.textFaint} fontSize={10}>
            {formatShortDate(new Date(geo.t0).toISOString())}
          </SvgText>
          <SvgText x={width - 8} y={height - 6} fill={c.textFaint} fontSize={10} textAnchor="end">
            {formatShortDate(new Date(geo.t1).toISOString())}
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}
