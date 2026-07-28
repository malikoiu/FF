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
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

const formatMoney = (value: number) => `$${formatCompact(value)}`;

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
  const [fileName, setFileName] = useState('Sample data');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const restore = async () => {
      try {
        const file = savedFile();
        if (!file.exists) return;
        const saved = JSON.parse(await file.text()) as { rows: DashboardRow[]; fileName: string };
        if (saved.rows?.length) {
          setRows(saved.rows);
          setFileName(saved.fileName || 'Last file');
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
    filters.region !== 'All',
    filters.category !== 'All',
    filters.channel !== 'All',
    filters.period !== 'All',
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
      const name = asset.name || 'Data file';
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
      const message = error instanceof Error ? error.message : 'The file could not be read.';
      Alert.alert('Data import failed', message);
    } finally {
      setLoading(false);
    }
  };

  const restoreSample = () => {
    Alert.alert('Use sample data?', 'This will replace the current dashboard. You can import your file again at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Use sample',
        onPress: () => {
          setRows(createSampleData());
          setFileName('Sample data');
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
              <Text style={styles.pageTitle}>Performance Dashboard</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import an Excel or CSV file"
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
                <Text style={styles.uploadIcon}>↑</Text>
                <Text style={styles.uploadText}>Import file</Text>
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
                Showing {formatCompact(filtered.length)} of {formatCompact(rows.length)} rows
              </Text>
            </View>
            <Pressable
              onPress={() => setFilterVisible(true)}
              style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
              <Text style={styles.filterGlyph}>≡</Text>
              <Text style={styles.filterButtonText}>
                Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
              </Text>
            </Pressable>
          </View>

          {!filtered.length ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⌁</Text>
              <Text style={styles.emptyTitle}>No results match these filters</Text>
              <Text style={styles.emptyBody}>Change the filters or select “All” to show your data.</Text>
              <Pressable
                onPress={() => setFilters(defaultFilters)}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>Reset filters</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.kpiGrid}>
                <KpiCard
                  label="Net Sales"
                  value={formatMoney(data.revenue)}
                  detail={filters.includeVat ? 'Including VAT' : 'Before VAT'}
                  color={palette.cyan}
                />
                <KpiCard
                  label="Average Order"
                  value={formatMoney(data.averageOrder)}
                  detail={`${formatCompact(data.orders)} orders`}
                  color="#F3F5FB"
                />
                <KpiCard
                  label="Growth"
                  value={`${data.growth >= 0 ? '+' : ''}${data.growth.toFixed(1)}%`}
                  detail="vs. previous half"
                  color={data.growth >= 0 ? palette.green : palette.pink}
                />
                <KpiCard
                  label="Return Rate"
                  value={`${data.returnRate.toFixed(1)}%`}
                  detail={`${data.margin.toFixed(1)}% margin`}
                  color={palette.pink}
                />
              </View>

              <View style={[styles.chartGrid, isWide && styles.chartGridWide]}>
                <Card title="Sales by Category" style={isWide ? styles.halfCard : undefined}>
                  <BarChart data={data.categories} width={chartWidth} />
                </Card>
                <Card
                  title="Sales Trend"
                  subtitle="Tap any point for details"
                  style={isWide ? styles.halfCard : undefined}>
                  <LineChart data={data.trend} width={chartWidth} compare={filters.comparePrevious} />
                </Card>
                <Card
                  title="Price vs. Quantity"
                  subtitle="Tap a point to explore"
                  style={isWide ? styles.halfCard : undefined}>
                  <ScatterChart data={data.scatter} width={chartWidth} />
                </Card>
                <Card title="Sales Channel Mix" style={isWide ? styles.halfCard : undefined}>
                  <DonutChart data={data.channels} width={chartWidth} />
                </Card>
              </View>

              <Card title="Top Product Details">
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.productCell]}>Product</Text>
                  <Text style={styles.tableHeaderText}>Sales</Text>
                  <Text style={styles.tableHeaderText}>Margin</Text>
                  <Text style={styles.tableHeaderText}>Growth</Text>
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
                    <Text style={styles.tableValue}>{product.margin.toFixed(0)}%</Text>
                    <Text style={[styles.tableValue, { color: product.growth >= 0 ? palette.green : palette.pink }]}>
                      {product.growth >= 0 ? '+' : ''}{product.growth.toFixed(0)}%
                    </Text>
                  </View>
                ))}
              </Card>

              <View style={styles.privacyNote}>
                <Text style={styles.privacyIcon}>◉</Text>
                <View style={styles.privacyCopy}>
                  <Text style={styles.privacyTitle}>Your data stays on your device</Text>
                  <Text style={styles.privacyBody}>
                    Files are processed locally. The app never sends your data to a server.
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
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Filters & Settings</Text>
              <Pressable onPress={() => setFilters(defaultFilters)} hitSlop={12}>
                <Text style={styles.resetText}>Reset</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <FilterGroup
                title="Period"
                values={['All', 'Last 3 months', 'Last 6 months', 'Last 12 months']}
                selected={filters.period}
                onSelect={(period) => patchFilters({ period: period as DashboardFilters['period'] })}
              />
              <FilterGroup
                title="Region"
                values={options.regions}
                selected={filters.region}
                onSelect={(region) => patchFilters({ region })}
              />
              <FilterGroup
                title="Category"
                values={options.categories}
                selected={filters.category}
                onSelect={(category) => patchFilters({ category })}
              />
              <FilterGroup
                title="Sales Channel"
                values={options.channels}
                selected={filters.channel}
                onSelect={(channel) => patchFilters({ channel })}
              />

              <View style={styles.switchGroup}>
                <Text style={styles.filterTitle}>Calculation Options</Text>
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.switchTitle}>Include VAT</Text>
                    <Text style={styles.switchSubtitle}>Add 15% to sales</Text>
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
                    <Text style={styles.switchTitle}>Deduct Returns</Text>
                    <Text style={styles.switchSubtitle}>Show net sales after returns</Text>
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
                    <Text style={styles.switchTitle}>Compare Previous Period</Text>
                    <Text style={styles.switchSubtitle}>Show a reference line on the trend chart</Text>
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
                <Text style={styles.columnsTitle}>Supported Columns</Text>
                <Text style={styles.columnsBody}>
                  Date, Category, Region, Channel, Product, Sales, Orders, Returns,
                  Cost, Quantity, and Price.
                </Text>
              </View>

              <Pressable
                onPress={restoreSample}
                style={({ pressed }) => [styles.sampleButton, pressed && styles.pressed]}>
                <Text style={styles.sampleButtonText}>Show Sample Data</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    backgroundColor: 'rgba(10, 15, 31, 0.96)',
  },
  titleBlock: {
    flex: 1,
    flexDirection: 'row',
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
    flexDirection: 'row',
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
    flexDirection: 'row',
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
    textAlign: 'left',
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
    flexDirection: 'row',
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
    flexDirection: 'row',
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
    textAlign: 'left',
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
    flexDirection: 'row',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  cardTitle: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    textAlign: 'left',
  },
  cardSubtitle: {
    color: palette.secondary,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'left',
  },
  tableHeader: {
    minHeight: 34,
    flexDirection: 'row',
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
    textAlign: 'left',
  },
  tableRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  productNameCell: {
    flexDirection: 'row',
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
    textAlign: 'left',
  },
  tableValue: {
    flex: 0.65,
    color: '#BEC6DC',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  privacyNote: {
    flexDirection: 'row',
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
    textAlign: 'left',
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
    textAlign: 'left',
  },
  chipWrap: {
    flexDirection: 'row',
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
    textAlign: 'left',
  },
  switchSubtitle: {
    color: palette.secondary,
    fontSize: 10,
    marginTop: 3,
    textAlign: 'left',
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
    textAlign: 'left',
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

