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

const savedFile = () => new File(Paths.document, 'humanitarian-dashboard-data.json');

const formatCompact = (value: number) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

const formatMoney = (value: number, currency: DashboardFilters['currency']) =>
  `${currency} ${formatCompact(value)}`;

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
      aidTypes: uniqueValues(rows, 'aidType'),
      statuses: uniqueValues(rows, 'status'),
    }),
    [rows],
  );
  const activeFilterCount = [
    filters.region !== 'All',
    filters.aidType !== 'All',
    filters.status !== 'All',
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
              <Text style={styles.eyebrow}>HUMANITARIAN RESPONSE</Text>
              <Text style={styles.pageTitle}>Aid Operations Dashboard</Text>
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
                  label="People Reached"
                  value={formatCompact(data.beneficiaries)}
                  detail={`${formatCompact(data.households)} households`}
                  color={palette.cyan}
                />
                <KpiCard
                  label="Aid Delivered"
                  value={formatMoney(data.aidAmount, filters.currency)}
                  detail={`${formatMoney(data.averageAid, filters.currency)} per person`}
                  color="#F3F5FB"
                />
                <KpiCard
                  label="Target Coverage"
                  value={`${data.coverageRate.toFixed(1)}%`}
                  detail={`${formatCompact(data.targetBeneficiaries)} people targeted`}
                  color={data.coverageRate >= 85 ? palette.green : palette.purple}
                />
                <KpiCard
                  label="Urgent Cases"
                  value={formatCompact(data.urgentCases)}
                  detail={`${formatCompact(data.pendingCases)} cases pending`}
                  color={palette.pink}
                />
              </View>

              <View style={[styles.chartGrid, isWide && styles.chartGridWide]}>
                <Card title="People Reached by Aid Type" style={isWide ? styles.halfCard : undefined}>
                  <BarChart data={data.categories} width={chartWidth} />
                </Card>
                <Card
                  title="Monthly Reach Trend"
                  subtitle="Tap a point to inspect beneficiary reach"
                  style={isWide ? styles.halfCard : undefined}>
                  <LineChart data={data.trend} width={chartWidth} compare={filters.comparePrevious} />
                </Card>
                <Card
                  title={`Vulnerability vs. Aid per Person (${filters.currency})`}
                  subtitle="Tap a point to inspect a response activity"
                  style={isWide ? styles.halfCard : undefined}>
                  <ScatterChart
                    data={data.scatter}
                    width={chartWidth}
                    currency={filters.currency}
                  />
                </Card>
                <Card title="Regional Reach Mix" style={isWide ? styles.halfCard : undefined}>
                  <DonutChart data={data.channels} width={chartWidth} />
                </Card>
              </View>

              <Card title="Data Insights" subtitle="Automatically generated from the selected records">
                <View style={styles.insightList}>
                  {data.insights.map((insight) => (
                    <View
                      key={insight.title}
                      style={[
                        styles.insightRow,
                        insight.tone === 'warning' && styles.insightWarning,
                        insight.tone === 'positive' && styles.insightPositive,
                      ]}>
                      <View
                        style={[
                          styles.insightDot,
                          insight.tone === 'warning' && styles.insightDotWarning,
                          insight.tone === 'positive' && styles.insightDotPositive,
                        ]}
                      />
                      <View style={styles.insightCopy}>
                        <Text style={styles.insightTitle}>{insight.title}</Text>
                        <Text style={styles.insightBody}>{insight.body}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Card>

              <Card title="Recommended Actions" subtitle="Rule-based operational recommendations">
                <View style={styles.recommendationList}>
                  {data.recommendations.map((recommendation, index) => (
                    <View key={recommendation.title} style={styles.recommendationRow}>
                      <View style={styles.recommendationNumber}>
                        <Text style={styles.recommendationNumberText}>{index + 1}</Text>
                      </View>
                      <View style={styles.insightCopy}>
                        <View style={styles.recommendationHeading}>
                          <Text style={styles.insightTitle}>{recommendation.title}</Text>
                          <Text
                            style={[
                              styles.priorityBadge,
                              recommendation.priority === 'High' && styles.priorityHigh,
                            ]}>
                            {recommendation.priority}
                          </Text>
                        </View>
                        <Text style={styles.insightBody}>{recommendation.body}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Card>

              <Card title="Priority Program Details">
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.productCell]}>Program</Text>
                  <Text style={styles.tableHeaderText}>Reached</Text>
                  <Text style={styles.tableHeaderText}>Coverage</Text>
                  <Text style={styles.tableHeaderText}>Urgent</Text>
                </View>
                {data.programs.map((program, index) => (
                  <View
                    key={program.name}
                    style={[styles.tableRow, index === data.programs.length - 1 && styles.lastRow]}>
                    <View style={[styles.productCell, styles.productNameCell]}>
                      <View style={[styles.rank, { backgroundColor: `${['#63E6E2', '#9B7BFF', '#4CA6FF', '#FF73B3', '#FFC857'][index]}22` }]}>
                        <Text style={styles.rankText}>{index + 1}</Text>
                      </View>
                      <Text numberOfLines={1} style={styles.productName}>{program.name}</Text>
                    </View>
                    <Text style={styles.tableValue}>{formatCompact(program.beneficiaries)}</Text>
                    <Text style={styles.tableValue}>{program.coverage.toFixed(0)}%</Text>
                    <Text style={[styles.tableValue, { color: program.urgent ? palette.pink : palette.green }]}>
                      {formatCompact(program.urgent)}
                    </Text>
                  </View>
                ))}
              </Card>

              <View style={styles.privacyNote}>
                <Text style={styles.privacyIcon}>◉</Text>
                <View style={styles.privacyCopy}>
                  <Text style={styles.privacyTitle}>Sensitive humanitarian data stays on your device</Text>
                  <Text style={styles.privacyBody}>
                    Files, insights, and recommendations are processed locally. Nothing is sent to a server.
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
                title="Aid Type"
                values={options.aidTypes}
                selected={filters.aidType}
                onSelect={(aidType) => patchFilters({ aidType })}
              />
              <FilterGroup
                title="Program Status"
                values={options.statuses}
                selected={filters.status}
                onSelect={(status) => patchFilters({ status })}
              />
              <FilterGroup
                title="Currency"
                values={['USD', 'SAR']}
                selected={filters.currency}
                onSelect={(currency) =>
                  patchFilters({ currency: currency as DashboardFilters['currency'] })
                }
              />

              <View style={styles.switchGroup}>
                <Text style={styles.filterTitle}>Analysis Options</Text>
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.switchTitle}>Include Pending Caseload</Text>
                    <Text style={styles.switchSubtitle}>Add pending cases to the coverage denominator</Text>
                  </View>
                  <Switch
                    value={filters.includePending}
                    onValueChange={(includePending) => patchFilters({ includePending })}
                    trackColor={{ false: '#303A55', true: '#337C7B' }}
                    thumbColor={filters.includePending ? palette.cyan : '#D7DCE9'}
                  />
                </View>
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.switchTitle}>Prioritize Urgent Gaps</Text>
                    <Text style={styles.switchSubtitle}>Rank programs using urgent caseload and severity</Text>
                  </View>
                  <Switch
                    value={filters.prioritizeUrgent}
                    onValueChange={(prioritizeUrgent) => patchFilters({ prioritizeUrgent })}
                    trackColor={{ false: '#303A55', true: '#337C7B' }}
                    thumbColor={filters.prioritizeUrgent ? palette.cyan : '#D7DCE9'}
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
                  Date, Region, Aid Type, Program, Partner, Status, Beneficiaries,
                  Households, Aid Amount, Target Beneficiaries, Urgent Cases,
                  Delivered Cases, Pending Cases, and Vulnerability Score.
                </Text>
                <Text style={styles.columnsBody}>
                  Select USD or SAR above to label every monetary amount. The app
                  does not convert values between currencies.
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
  insightList: {
    gap: 9,
  },
  insightRow: {
    flexDirection: 'row',
    gap: 11,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#131C31',
    borderWidth: 1,
    borderColor: '#263250',
  },
  insightWarning: {
    backgroundColor: '#251926',
    borderColor: '#553047',
  },
  insightPositive: {
    backgroundColor: '#10251F',
    borderColor: '#225243',
  },
  insightDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 4,
    backgroundColor: palette.purple,
  },
  insightDotWarning: {
    backgroundColor: palette.pink,
  },
  insightDotPositive: {
    backgroundColor: palette.green,
  },
  insightCopy: {
    flex: 1,
  },
  insightTitle: {
    color: palette.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  insightBody: {
    color: '#9FA9C4',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 3,
  },
  recommendationList: {
    gap: 4,
  },
  recommendationRow: {
    flexDirection: 'row',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  recommendationNumber: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#252F50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationNumberText: {
    color: palette.cyan,
    fontSize: 11,
    fontWeight: '900',
  },
  recommendationHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  priorityBadge: {
    color: palette.purple,
    backgroundColor: '#292342',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 9,
    fontWeight: '800',
    overflow: 'hidden',
  },
  priorityHigh: {
    color: palette.pink,
    backgroundColor: '#3A2031',
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

