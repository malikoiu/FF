import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline } from 'react-native-svg';

const colors = ['#63E6E2', '#9B7BFF', '#4CA6FF', '#FF73B3', '#FFC857', '#48D597'];

const compact = (value: number) =>
  new Intl.NumberFormat('ar-SA', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

type SeriesPoint = { label: string; value: number };

export function BarChart({ data, width }: { data: SeriesPoint[]; width: number }) {
  const [selected, setSelected] = useState<number | null>(null);
  const height = 150;
  const max = Math.max(1, ...data.map((item) => item.value));
  const gap = 8;
  const barWidth = Math.max(15, (width - gap * Math.max(0, data.length - 1)) / Math.max(1, data.length));

  return (
    <View>
      <View style={[styles.barArea, { height }]}>
        {data.map((item, index) => {
          const barHeight = Math.max(12, (item.value / max) * 118);
          const active = selected === index;
          return (
            <Pressable
              key={item.label}
              accessibilityLabel={`${item.label}: ${compact(item.value)}`}
              onPress={() => setSelected(active ? null : index)}
              style={[
                styles.barColumn,
                { width: barWidth },
              ]}>
              {active && <Text style={styles.tooltip}>{compact(item.value)}</Text>}
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: colors[index % colors.length],
                    opacity: selected === null || active ? 1 : 0.38,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axisLabels}>
        {data.map((item) => (
          <Text key={item.label} numberOfLines={1} style={[styles.axisLabel, { width: barWidth }]}>
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function LineChart({
  data,
  width,
  compare,
}: {
  data: SeriesPoint[];
  width: number;
  compare: boolean;
}) {
  const height = 156;
  const pad = 14;
  const max = Math.max(1, ...data.map((item) => item.value));
  const min = Math.min(...data.map((item) => item.value), 0);
  const range = Math.max(1, max - min);
  const points = data.map((item, index) => {
    const x = pad + (index * (width - pad * 2)) / Math.max(1, data.length - 1);
    const y = height - pad - ((item.value - min) / range) * (height - pad * 2);
    return { ...item, x, y };
  });
  const previous = points.map((point, index) => ({
    ...point,
    y: Math.min(height - pad, point.y + 15 + (index % 3) * 3),
  }));
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <View>
      <Svg width={width} height={height}>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <Line
            key={ratio}
            x1={pad}
            x2={width - pad}
            y1={height * ratio}
            y2={height * ratio}
            stroke="#25304D"
            strokeWidth={1}
          />
        ))}
        {compare && (
          <Polyline
            points={previous.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke="#6E7896"
            strokeWidth={2}
          />
        )}
        <Polyline
          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke="#63E6E2"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point, index) => (
          <Circle
            key={`${point.label}-${index}`}
            cx={point.x}
            cy={point.y}
            r={selected === index ? 7 : 4}
            fill="#63E6E2"
            stroke="#10172B"
            strokeWidth={3}
            onPress={() => setSelected(selected === index ? null : index)}
          />
        ))}
      </Svg>
      {selected !== null && points[selected] && (
        <Text style={styles.lineValue}>
          {points[selected].label} Â· {compact(points[selected].value)}
        </Text>
      )}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#63E6E2' }]} />
          <Text style={styles.legendText}>Ø§Ù„ÙØªØ±Ø© Ø§Ù„Ø­Ø§Ù„ÙŠØ©</Text>
        </View>
        {compare && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#6E7896' }]} />
            <Text style={styles.legendText}>Ø§Ù„ÙØªØ±Ø© Ø§Ù„Ø³Ø§Ø¨Ù‚Ø©</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const polar = (cx: number, cy: number, radius: number, angle: number) => ({
  x: cx + radius * Math.cos(((angle - 90) * Math.PI) / 180),
  y: cy + radius * Math.sin(((angle - 90) * Math.PI) / 180),
});

const arc = (cx: number, cy: number, radius: number, start: number, end: number) => {
  const from = polar(cx, cy, radius, end);
  const to = polar(cx, cy, radius, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${large} 0 ${to.x} ${to.y}`;
};

export function DonutChart({ data, width }: { data: SeriesPoint[]; width: number }) {
  const size = Math.min(170, width * 0.48);
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0));
  const segments = useMemo(() => {
    let start = 0;
    return data.map((item, index) => {
      const sweep = (item.value / total) * 359.5;
      const segment = { ...item, start, end: start + sweep, color: colors[index % colors.length] };
      start += sweep;
      return segment;
    });
  }, [data, total]);

  return (
    <View style={styles.donutLayout}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.34}
            fill="none"
            stroke="#25304D"
            strokeWidth={22}
          />
          <G>
            {segments.map((segment) => (
              <Path
                key={segment.label}
                d={arc(size / 2, size / 2, size * 0.34, segment.start, segment.end)}
                fill="none"
                stroke={segment.color}
                strokeWidth={22}
                strokeLinecap="butt"
              />
            ))}
          </G>
        </Svg>
        <View style={styles.donutCenter}>
          <Text style={styles.donutTotal}>{compact(total)}</Text>
          <Text style={styles.donutCaption}>Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ</Text>
        </View>
      </View>
      <View style={styles.donutLegend}>
        {segments.map((segment) => (
          <View key={segment.label} style={styles.channelRow}>
            <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
            <Text numberOfLines={1} style={styles.channelName}>{segment.label}</Text>
            <Text style={styles.channelValue}>{Math.round((segment.value / total) * 100)}Ùª</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ScatterChart({
  data,
  width,
}: {
  data: { x: number; y: number; label: string }[];
  width: number;
}) {
  const height = 165;
  const pad = 18;
  const maxX = Math.max(1, ...data.map((item) => item.x));
  const maxY = Math.max(1, ...data.map((item) => item.y));
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="#39425C" />
        <Line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="#39425C" />
        {data.map((item, index) => {
          const x = pad + (item.x / maxX) * (width - pad * 2);
          const y = height - pad - (item.y / maxY) * (height - pad * 2);
          return (
            <Circle
              key={`${item.label}-${index}`}
              cx={x}
              cy={y}
              r={selected === index ? 7 : 4.5}
              fill={colors[index % 2]}
              opacity={selected === null || selected === index ? 0.95 : 0.28}
              onPress={() => setSelected(selected === index ? null : index)}
            />
          );
        })}
      </Svg>
      {selected !== null && data[selected] && (
        <Text style={styles.lineValue}>
          {data[selected].label} Â· ÙƒÙ…ÙŠØ© {compact(data[selected].x)} Â· Ø³Ø¹Ø± {compact(data[selected].y)}
        </Text>
      )}
      <View style={styles.scatterLabels}>
        <Text style={styles.axisLabel}>Ø§Ù„Ø³Ø¹Ø± â†‘</Text>
        <Text style={styles.axisLabel}>Ø§Ù„ÙƒÙ…ÙŠØ© â†</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 28,
  },
  barColumn: {
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    borderRadius: 7,
    minHeight: 12,
  },
  tooltip: {
    position: 'absolute',
    top: 0,
    color: '#F8FAFF',
    fontSize: 10,
    fontWeight: '700',
  },
  axisLabels: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  axisLabel: {
    color: '#8D96B2',
    fontSize: 10,
    textAlign: 'center',
  },
  lineValue: {
    color: '#D8DEEF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: -3,
  },
  legendRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 18,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#8D96B2',
    fontSize: 11,
  },
  donutLayout: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  donutCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTotal: {
    color: '#F7F9FF',
    fontSize: 17,
    fontWeight: '800',
  },
  donutCaption: {
    color: '#8790AA',
    fontSize: 10,
  },
  donutLegend: {
    flex: 1,
    gap: 11,
    paddingLeft: 8,
  },
  channelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
  },
  channelName: {
    color: '#B8C0D7',
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  channelValue: {
    color: '#F4F6FC',
    fontSize: 12,
    fontWeight: '700',
    minWidth: 32,
  },
  scatterLabels: {
    marginTop: -8,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
});
