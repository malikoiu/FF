import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarChart, DonutChart, LineChart, ScatterChart } from '@/components/dashboard-charts';
import {
  aggregateData,
  createSampleData,
  DashboardFilters,
  DashboardRow,
  defaultFilters,
  filterRows,
  parseWorkbook,
  uniqueValues,
} from '@/lib/dashboard-data';

const palette = {
  background: '#070B18',
  surface: '#10172B',
  surfaceRaised: '#151D34',
  border: '#232D4A',
  text: '#F7F9FF',
  secondary: '#939DB9',
  cyan: '#63E6E2',
  purple: '#9B7BFF',
  pink: '#FF73B3',
  green: '#48D597',
};

const savedFile = () => new File(Paths.document, 'dashboard-data.json');

const formatCompact = (value: number) =>
  new Intl.NumberFormat('ar-SA', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

const formatMoney = (value: number) => `${formatCompact(value)} Ø±.Ø³`;

type CardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  style?: object;
};

function Card({ title, subtitle, children, style }: CardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function KpiCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiAccent, { backgroundColor: color }]} />
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kpiValue, { color }]}>
        {value}
      </Text>
      <Text style={styles.kpiDetail}>{detail}</Text>
    </View>
  );
}

function FilterGroup({
  title,
  values,
  selected,
  onSelect,
}: {
  title: string;
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterTitle}>{title}</Text>
      <View style={styles.chipWrap}>
        {values.map((value) => {
          const active = value === selected;
          return (
            <Pressable
              key={value}
              onPress={() => onSelect(value)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{value}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const chartWidth = Math.max(250, isWide ? (width - 44) / 2 - 32 : width - 64);
  const [rows, setRows] = useState<DashboardRow[]>(createSampleData);
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [filterVisible, setFilterVisible] = useState(false);
  const [fileName, setFileName] = useState('Ø¨ÙŠØ§Ù†Ø§Øª ØªØ¬Ø±ÙŠØ¨ÙŠØ©');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const restore = async () => {
      try {
        const file = savedFile();
        if (!file.exists) return;
        const saved = JSON.parse(await file.text()) as { rows: DashboardRow[]; fileName: string };
        if (saved.rows?.length) {
          setRows(saved.rows);
          setFileName(saved.fileName || 'Ø¢Ø®Ø± Ù…Ù„Ù');
        }
      } catch {
        // A damaged cache should never block the dashboard from opening.
      }
    };
    restore();
  }, []);

  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const data = useMemo(() => aggregateData(filtered, filters), [filtered, filters]);
  const options = useMemo(
    () => ({
      regions: uniqueValues(rows, 'region'),
      categories: uniqueValues(rows, 'category'),
      channels: uniqueValues(rows, 'channel'),
    }),
    [rows],
  );
  const activeFilterCount = [
    filters.region !== 'Ø§Ù„ÙƒÙ„',
    filters.category !== 'Ø§Ù„ÙƒÙ„',
    filters.channel !== 'Ø§Ù„ÙƒÙ„',
    filters.period !== 'Ø§Ù„ÙƒÙ„',
  ].filter(Boolean).length;

  const patchFilters = (patch: Partial<DashboardFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  const importFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) return;

      setLoading(true);
      const asset = result.assets[0];
      const pickedFile = new File(asset.uri);
      const parsed = parseWorkbook(await pickedFile.bytes());
      const name = asset.name || 'Ù…Ù„Ù Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª';
      setRows(parsed);
      setFileName(name);
      setFilters(defaultFilters);

      try {
        const cache = savedFile();
        cache.create({ overwrite: true, intermediates: true });
        cache.write(JSON.stringify({ rows: parsed, fileName: name }));
      } catch {
        // Import remains useful even if the device cannot persist the cache.
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ØªØ¹Ø°Ù‘Ø±Øª Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ù…Ù„Ù.';
      Alert.alert('Ù„Ù… ÙŠØªÙ… Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª', message);
    } finally {
      setLoading(false);
    }
  };

  const restoreSample = () => {
    Alert.alert('Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªØ¬Ø±ÙŠØ¨ÙŠØ©ØŸ', 'Ø³ÙŠØªÙ… Ø§Ø³ØªØ¨Ø¯Ø§Ù„ Ø§Ù„Ø¹Ø±Ø¶ Ø§Ù„Ø­Ø§Ù„ÙŠ ÙÙ‚Ø·ØŒ ÙˆÙŠÙ…ÙƒÙ†Ùƒ Ø±ÙØ¹ Ù…Ù„ÙÙƒ Ù…Ø¬Ø¯Ø¯Ø§Ù‹.', [
      { text: 'Ø¥Ù„ØºØ§Ø¡', style: 'cancel' },
      {
        text: 'Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ù†Ù…ÙˆØ°Ø¬',
        onPress: () => {
          setRows(createSampleData());
          setFileName('Ø¨ÙŠØ§Ù†Ø§Øª ØªØ¬Ø±ÙŠØ¨ÙŠØ©');
          setFilters(defaultFilters);
          setFilterVisible(false);
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.topBar}>
          <View style={styles.titleBlock}>
            <View style={styles.logo}>
              <View style={styles.logoBarShort} />
              <View style={styles.logoBarTall} />
              <View style={styles.logoDot} />
            </View>
            <View style={styles.titleCopy}>
              <Text style={styles.eyebrow}>ANALYTICS EXPLORER</Text>
              <Text style={styles.pageTitle}>Ù„ÙˆØ­Ø© Ø§Ù„Ø£Ø¯Ø§Ø¡</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ø±ÙØ¹ Ù…Ù„Ù Excel Ø£Ùˆ CSV"
            onPress={importFile}
            disabled={loading}
            style={({ pressed }) => [
              styles.uploadButton,
              pressed && styles.pressed,
              loading && styles.disabled,
            ]}>
            {loading ? (
              <ActivityIndicator size="small" color={palette.background} />
            ) : (
              <>
                <Text style={styles.uploadIcon}>â†‘</Text>
                <Text style={styles.uploadText}>Ø±ÙØ¹ Ù…Ù„Ù</Text>
              </>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical>
          <View style={styles.fileStrip}>
            <View style={styles.liveDot} />
            <View style={styles.fileCopy}>
              <Text numberOfLines={1} style={styles.fileName}>{fileName}</Text>
              <Text style={styles.fileMeta}>
                {formatCompact(filtered.length)} ØµÙ Ù…Ø¹Ø±ÙˆØ¶ Ù…Ù† {formatCompact(rows.length)}
              </Text>
            </View>
            <Pressable
              onPress={() => setFilterVisible(true)}
              style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
              <Text style={styles.filterGlyph}>â‰¡</Text>
              <Text style={styles.filterButtonText}>
                Ø§Ù„ÙÙ„Ø§ØªØ±{activeFilterCount ? ` (${activeFilterCount})` : ''}
              </Text>
            </Pressable>
          </View>

          {!filtered.length ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>âŒ</Text>
              <Text style={styles.emptyTitle}>Ù„Ø§ ØªÙˆØ¬Ø¯ Ù†ØªØ§Ø¦Ø¬ Ø¨Ù‡Ø°Ù‡ Ø§Ù„ÙÙ„Ø§ØªØ±</Text>
              <Text style={styles.emptyBody}>ØºÙŠÙ‘Ø± Ø§Ù„ÙÙ„Ø§ØªØ± Ø£Ùˆ Ø§Ø®ØªØ± â€œØ§Ù„ÙƒÙ„â€ Ù„Ø¥Ø¸Ù‡Ø§Ø± Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.</Text>
              <Pressable
                onPress={() => setFilters(defaultFilters)}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>Ø¥Ø¹Ø§Ø¯Ø© Ø¶Ø¨Ø· Ø§Ù„ÙÙ„Ø§ØªØ±</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.kpiGrid}>
                <KpiCard
                  label="ØµØ§ÙÙŠ Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª"
                  value={formatMoney(data.revenue)}
                  detail={filters.includeVat ? 'Ø´Ø§Ù…Ù„ Ø§Ù„Ø¶Ø±ÙŠØ¨Ø©' : 'Ù‚Ø¨Ù„ Ø§Ù„Ø¶Ø±ÙŠØ¨Ø©'}
                  color={palette.cyan}
                />
                <KpiCard
                  label="Ù…ØªÙˆØ³Ø· Ø§Ù„Ø·Ù„Ø¨"
                  value={formatMoney(data.averageOrder)}
                  detail={`${formatCompact(data.orders)} Ø·Ù„Ø¨`}
                  color="#F3F5FB"
                />
                <KpiCard
                  label="Ø§Ù„Ù†Ù…Ùˆ"
                  value={`${data.growth >= 0 ? '+' : ''}${data.growth.toFixed(1)}Ùª`}
                  detail="Ù…Ù‚Ø§Ø¨Ù„ Ø§Ù„Ù†ØµÙ Ø§Ù„Ø³Ø§Ø¨Ù‚"
                  color={data.growth >= 0 ? palette.green : palette.pink}
                />
                <KpiCard
                  label="Ù†Ø³Ø¨Ø© Ø§Ù„Ù…Ø±ØªØ¬Ø¹Ø§Øª"
                  value={`${data.returnRate.toFixed(1)}Ùª`}
                  detail={`Ù‡Ø§Ù…Ø´ ${data.margin.toFixed(1)}Ùª`}
                  color={palette.pink}
                />
              </View>

              <View style={[styles.chartGrid, isWide && styles.chartGridWide]}>
                <Card title="Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª Ø­Ø³Ø¨ Ø§Ù„ÙØ¦Ø©" style={isWide ? styles.halfCard : undefined}>
                  <BarChart data={data.categories} width={chartWidth} />
                </Card>
                <Card
                  title="Ø§ØªØ¬Ø§Ù‡ Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª"
                  subtitle="Ø§Ø¶ØºØ· Ø¹Ù„Ù‰ Ø£ÙŠ Ù†Ù‚Ø·Ø© Ù„Ù„ØªÙØ§ØµÙŠÙ„"
                  style={isWide ? styles.halfCard : undefined}>
                  <LineChart data={data.trend} width={chartWidth} compare={filters.comparePrevious} />
                </Card>
                <Card
                  title="Ø§Ù„Ø³Ø¹Ø± Ù…Ù‚Ø§Ø¨Ù„ Ø§Ù„ÙƒÙ…ÙŠØ©"
                  subtitle="Ø§Ø¶ØºØ· Ø¹Ù„Ù‰ Ø§Ù„Ù†Ù‚Ø§Ø· Ù„Ø§Ø³ØªÙƒØ´Ø§ÙÙ‡Ø§"
                  style={isWide ? styles.halfCard : undefined}>
                  <ScatterChart data={data.scatter} width={chartWidth} />
                </Card>
                <Card title="Ù…Ø²ÙŠØ¬ Ù‚Ù†ÙˆØ§Øª Ø§Ù„Ø¨ÙŠØ¹" style={isWide ? styles.halfCard : undefined}>
                  <DonutChart data={data.channels} width={chartWidth} />
                </Card>
              </View>

              <Card title="ØªÙØ§ØµÙŠÙ„ Ø£ÙØ¶Ù„ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª">
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.productCell]}>Ø§Ù„Ù…Ù†ØªØ¬</Text>
                  <Text style={styles.tableHeaderText}>Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª</Text>
                  <Text style={styles.tableHeaderText}>Ø§Ù„Ù‡Ø§Ù…Ø´</Text>
                  <Text style={styles.tableHeaderText}>Ø§Ù„Ù†Ù…Ùˆ</Text>
                </View>
                {data.products.map((product, index) => (
                  <View
                    key={product.name}
                    style={[styles.tableRow, index === data.products.length - 1 && styles.lastRow]}>
                    <View style={[styles.productCell, styles.productNameCell]}>
                      <View style={[styles.rank, { backgroundColor: `${['#63E6E2', '#9B7BFF', '#4CA6FF', '#FF73B3', '#FFC857'][index]}22` }]}>
                        <Text style={styles.rankText}>{index + 1}</Text>
                      </View>
                      <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
                    </View>
                    <Text style={styles.tableValue}>{formatCompact(product.sales)}</Text>
                    <Text style={styles.tableValue}>{product.margin.toFixed(0)}Ùª</Text>
                    <Text style={[styles.tableValue, { color: product.growth >= 0 ? palette.green : palette.pink }]}>
                      {product.growth >= 0 ? '+' : ''}{product.growth.toFixed(0)}Ùª
                    </Text>
                  </View>
                ))}
              </Card>

              <View style={styles.privacyNote}>
                <Text style={styles.privacyIcon}>â—‰</Text>
                <View style={styles.privacyCopy}>
                  <Text style={styles.privacyTitle}>Ø¨ÙŠØ§Ù†Ø§ØªÙƒ ØªØ¨Ù‚Ù‰ Ø¹Ù„Ù‰ Ø¬Ù‡Ø§Ø²Ùƒ</Text>
                  <Text style={styles.privacyBody}>
                    ØªØªÙ… Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ù…Ù„Ù Ù…Ø­Ù„ÙŠØ§Ù‹ØŒ ÙˆÙ„Ø§ ÙŠØ±Ø³Ù„ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø¨ÙŠØ§Ù†Ø§ØªÙ‡ Ø¥Ù„Ù‰ Ø£ÙŠ Ø®Ø§Ø¯Ù….
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={filterVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.modalScreen}>
          <SafeAreaView edges={['top', 'bottom']} style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => setFilterVisible(false)}
                hitSlop={12}
                style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
                <Text style={styles.doneText}>ØªÙ…</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Ø§Ù„ÙÙ„Ø§ØªØ± ÙˆØ§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª</Text>
              <Pressable onPress={() => setFilters(defaultFilters)} hitSlop={12}>
                <Text style={styles.resetText}>Ø¥Ø¹Ø§Ø¯Ø© Ø¶Ø¨Ø·</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <FilterGroup
                title="Ø§Ù„ÙØªØ±Ø©"
                values={['Ø§Ù„ÙƒÙ„', 'Ø¢Ø®Ø± 3 Ø£Ø´Ù‡Ø±', 'Ø¢Ø®Ø± 6 Ø£Ø´Ù‡Ø±', 'Ø¢Ø®Ø± 12 Ø´Ù‡Ø±']}
                selected={filters.period}
                onSelect={(period) => patchFilters({ period: period as DashboardFilters['period'] })}
              />
              <FilterGroup
                title="Ø§Ù„Ù…Ù†Ø·Ù‚Ø©"
                values={options.regions}
                selected={filters.region}
                onSelect={(region) => patchFilters({ region })}
              />
              <FilterGroup
                title="Ø§Ù„ÙØ¦Ø©"
                values={options.categories}
                selected={filters.category}
                onSelect={(category) => patchFilters({ category })}
              />
              <FilterGroup
                title="Ù‚Ù†Ø§Ø© Ø§Ù„Ø¨ÙŠØ¹"
                values={options.channels}
                selected={filters.channel}
                onSelect={(channel) => patchFilters({ channel })}
              />

              <View style={styles.switchGroup}>
                <Text style={styles.filterTitle}>Ø®ÙŠØ§Ø±Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨</Text>
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.switchTitle}>Ø´Ø§Ù…Ù„ Ø¶Ø±ÙŠØ¨Ø© Ø§Ù„Ù‚ÙŠÙ…Ø© Ø§Ù„Ù…Ø¶Ø§ÙØ©</Text>
                    <Text style={styles.switchSubtitle}>Ø¥Ø¶Ø§ÙØ© 15Ùª Ø¥Ù„Ù‰ Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª</Text>
                  </View>
                  <Switch
                    value={filters.includeVat}
                    onValueChange={(includeVat) => patchFilters({ includeVat })}
                    trackColor={{ false: '#303A55', true: '#337C7B' }}
                    thumbColor={filters.includeVat ? palette.cyan : '#D7DCE9'}
                  />
                </View>
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.switchTitle}>Ø®ØµÙ… Ø§Ù„Ù…Ø±ØªØ¬Ø¹Ø§Øª</Text>
                    <Text style={styles.switchSubtitle}>Ø¹Ø±Ø¶ ØµØ§ÙÙŠ Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§Øª Ø¨Ø¹Ø¯ Ø§Ù„Ø¥Ø±Ø¬Ø§Ø¹</Text>
                  </View>
                  <Switch
                    value={filters.excludeReturns}
                    onValueChange={(excludeReturns) => patchFilters({ excludeReturns })}
                    trackColor={{ false: '#303A55', true: '#337C7B' }}
                    thumbColor={filters.excludeReturns ? palette.cyan : '#D7DCE9'}
                  />
                </View>
                <View style={[styles.switchRow, styles.lastSwitchRow]}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.switchTitle}>Ù…Ù‚Ø§Ø±Ù†Ø© Ø¨Ø§Ù„ÙØªØ±Ø© Ø§Ù„Ø³Ø§Ø¨Ù‚Ø©</Text>
                    <Text style={styles.switchSubtitle}>Ø¥Ø¸Ù‡Ø§Ø± Ø®Ø· Ù…Ø±Ø¬Ø¹ÙŠ ÙÙŠ Ù…Ø®Ø·Ø· Ø§Ù„Ø§ØªØ¬Ø§Ù‡</Text>
                  </View>
                  <Switch
                    value={filters.comparePrevious}
                    onValueChange={(comparePrevious) => patchFilters({ comparePrevious })}
                    trackColor={{ false: '#303A55', true: '#337C7B' }}
                    thumbColor={filters.comparePrevious ? palette.cyan : '#D7DCE9'}
                  />
                </View>
              </View>

              <View style={styles.columnsHint}>
                <Text style={styles.columnsTitle}>Ø§Ù„Ø£Ø¹Ù…Ø¯Ø© Ø§Ù„ØªÙŠ ÙŠØªØ¹Ø±Ù‘Ù Ø¹Ù„ÙŠÙ‡Ø§ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚</Text>
                <Text style={styles.columnsBody}>
                  Ø§Ù„ØªØ§Ø±ÙŠØ®ØŒ Ø§Ù„ÙØ¦Ø©ØŒ Ø§Ù„Ù…Ù†Ø·Ù‚Ø©ØŒ Ø§Ù„Ù‚Ù†Ø§Ø©ØŒ Ø§Ù„Ù…Ù†ØªØ¬ØŒ Ø§Ù„Ù…Ø¨ÙŠØ¹Ø§ØªØŒ Ø§Ù„Ø·Ù„Ø¨Ø§ØªØŒ Ø§Ù„Ù…Ø±ØªØ¬Ø¹Ø§ØªØŒ
                  Ø§Ù„ØªÙƒÙ„ÙØ©ØŒ Ø§Ù„ÙƒÙ…ÙŠØ©ØŒ Ø§Ù„Ø³Ø¹Ø±. ÙŠÙ‚Ø¨Ù„ Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„Ø£Ø¹Ù…Ø¯Ø© Ø¨Ø§Ù„Ø¹Ø±Ø¨ÙŠ Ø£Ùˆ Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠ.
                </Text>
              </View>

              <Pressable
                onPress={restoreSample}
                style={({ pressed }) => [styles.sampleButton, pressed && styles.pressed]}>
                <Text style={styles.sampleButtonText}>Ø¹Ø±Ø¶ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªØ¬Ø±ÙŠØ¨ÙŠØ©</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    minHeight: 76,
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    backgroundColor: 'rgba(10, 15, 31, 0.96)',
  },
  titleBlock: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 11,
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#171F38',
    borderWidth: 1,
    borderColor: '#2B3758',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: 10,
    gap: 4,
  },
  logoBarShort: {
    width: 5,
    height: 11,
    borderRadius: 3,
    backgroundColor: palette.purple,
  },
  logoBarTall: {
    width: 5,
    height: 19,
    borderRadius: 3,
    backgroundColor: palette.cyan,
  },
  logoDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.pink,
  },
  titleCopy: {
    alignItems: 'flex-end',
  },
  eyebrow: {
    color: '#747F9F',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  pageTitle: {
    color: palette.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  uploadButton: {
    minWidth: 92,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: palette.cyan,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  uploadIcon: {
    color: palette.background,
    fontSize: 20,
    fontWeight: '800',
    marginTop: -2,
  },
  uploadText: {
    color: palette.background,
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    padding: 16,
    paddingBottom: 44,
    gap: 14,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  fileStrip: {
    minHeight: 60,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#0D1426',
    paddingHorizontal: 13,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: palette.green,
    shadowColor: palette.green,
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  fileCopy: {
    flex: 1,
    alignItems: 'flex-end',
  },
  fileName: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  fileMeta: {
    color: palette.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  filterButton: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 11,
    backgroundColor: palette.surfaceRaised,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  filterGlyph: {
    color: palette.cyan,
    fontSize: 18,
    transform: [{ rotate: '90deg' }],
  },
  filterButtonText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    minWidth: '47%',
    flex: 1,
    minHeight: 126,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    overflow: 'hidden',
    alignItems: 'flex-end',
  },
  kpiAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 4,
    height: '100%',
  },
  kpiLabel: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 8,
    width: '100%',
    textAlign: 'right',
  },
  kpiDetail: {
    color: '#7F89A5',
    fontSize: 10,
    marginTop: 3,
  },
  chartGrid: {
    gap: 14,
  },
  chartGridWide: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
  },
  halfCard: {
    width: '49%',
    flexGrow: 1,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    padding: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  cardTitle: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    textAlign: 'right',
  },
  cardSubtitle: {
    color: palette.secondary,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'right',
  },
  tableHeader: {
    minHeight: 34,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  tableHeaderText: {
    color: palette.secondary,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    flex: 0.65,
  },
  productCell: {
    flex: 1.55,
    textAlign: 'right',
  },
  tableRow: {
    minHeight: 54,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  productNameCell: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '800',
  },
  productName: {
    color: '#DCE1EF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  tableValue: {
    flex: 0.65,
    color: '#BEC6DC',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  privacyNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: '#0D1925',
    borderWidth: 1,
    borderColor: '#19313B',
  },
  privacyIcon: {
    color: palette.cyan,
    fontSize: 18,
  },
  privacyCopy: {
    flex: 1,
    alignItems: 'flex-end',
  },
  privacyTitle: {
    color: '#DFFCF9',
    fontSize: 12,
    fontWeight: '800',
  },
  privacyBody: {
    color: '#81A7A7',
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'right',
  },
  emptyState: {
    minHeight: 360,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIcon: {
    color: palette.purple,
    fontSize: 46,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
  },
  emptyBody: {
    color: palette.secondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 13,
    backgroundColor: palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  secondaryButtonText: {
    color: palette.cyan,
    fontSize: 13,
    fontWeight: '800',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#0A0F1E',
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  modalTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '800',
  },
  doneButton: {
    minWidth: 46,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cyan,
  },
  doneText: {
    color: palette.background,
    fontSize: 13,
    fontWeight: '800',
  },
  resetText: {
    color: palette.purple,
    fontSize: 12,
    fontWeight: '700',
  },
  modalContent: {
    padding: 18,
    paddingBottom: 38,
    gap: 24,
  },
  filterGroup: {
    gap: 10,
  },
  filterTitle: {
    color: '#DCE2F1',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  chipWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: palette.cyan,
    backgroundColor: '#133237',
  },
  chipText: {
    color: palette.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#DFFFFD',
    fontWeight: '800',
  },
  switchGroup: {
    borderRadius: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 15,
    paddingTop: 15,
  },
  switchRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  lastSwitchRow: {
    borderBottomWidth: 0,
  },
  switchCopy: {
    flex: 1,
    alignItems: 'flex-end',
    paddingLeft: 15,
  },
  switchTitle: {
    color: '#E4E8F3',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  switchSubtitle: {
    color: palette.secondary,
    fontSize: 10,
    marginTop: 3,
    textAlign: 'right',
  },
  columnsHint: {
    borderRadius: 17,
    padding: 15,
    backgroundColor: '#13152A',
    borderWidth: 1,
    borderColor: '#2C294A',
    alignItems: 'flex-end',
  },
  columnsTitle: {
    color: '#E5DFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  columnsBody: {
    color: '#A39ABA',
    fontSize: 11,
    lineHeight: 19,
    textAlign: 'right',
    marginTop: 5,
  },
  sampleButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleButtonText: {
    color: palette.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
});
