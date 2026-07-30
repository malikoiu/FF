import * as XLSX from 'xlsx';

export type DashboardRow = {
  date: string;
  region: string;
  aidType: string;
  program: string;
  partner: string;
  status: string;
  beneficiaries: number;
  households: number;
  aidAmount: number;
  targetBeneficiaries: number;
  urgentCases: number;
  deliveredCases: number;
  pendingCases: number;
  vulnerabilityScore: number;
};

export type DashboardFilters = {
  region: string;
  aidType: string;
  status: string;
  period: 'All' | 'Last 3 months' | 'Last 6 months' | 'Last 12 months';
  currency: 'USD' | 'SAR';
  includePending: boolean;
  prioritizeUrgent: boolean;
  comparePrevious: boolean;
};

export type Insight = {
  title: string;
  body: string;
  tone: 'positive' | 'warning' | 'info';
};

export type Recommendation = {
  title: string;
  body: string;
  priority: 'High' | 'Medium' | 'Monitor';
};

const ALL = 'All';

const aliases: Record<keyof DashboardRow, string[]> = {
  date: ['date', 'reportdate', 'distributiondate', 'التاريخ', 'تاريخ', 'تاريخالتوزيع'],
  region: ['region', 'area', 'location', 'governorate', 'المنطقة', 'الموقع', 'المحافظة'],
  aidType: ['aidtype', 'assistancetype', 'sector', 'category', 'نوعالمساعدة', 'القطاع', 'الفئة'],
  program: ['program', 'project', 'activity', 'البرنامج', 'المشروع', 'النشاط'],
  partner: ['partner', 'organization', 'ngo', 'implementingpartner', 'الشريك', 'المنظمة', 'الجهةالمنفذة'],
  status: ['status', 'programstatus', 'deliveryStatus', 'الحالة', 'حالةالبرنامج'],
  beneficiaries: ['beneficiaries', 'peoplereached', 'reached', 'individuals', 'المستفيدون', 'المستفيدين', 'الافراد'],
  households: ['households', 'families', 'hh', 'الأسر', 'الاسر', 'العائلات'],
  aidAmount: ['aidamount', 'amount', 'funding', 'distributedvalue', 'قيمةالمساعدة', 'المبلغ', 'التمويل'],
  targetBeneficiaries: ['targetbeneficiaries', 'target', 'plannedreach', 'المستهدفون', 'المستهدفين', 'المستهدف'],
  urgentCases: ['urgentcases', 'criticalcases', 'highprioritycases', 'الحالاتالعاجلة', 'الحالاتالحرجة'],
  deliveredCases: ['deliveredcases', 'completedcases', 'servedcases', 'الحالاتالمنفذة', 'الحالاتالمكتملة'],
  pendingCases: ['pendingcases', 'backlog', 'waitingcases', 'الحالاتالمعلقة', 'قائمةالانتظار'],
  vulnerabilityScore: ['vulnerabilityscore', 'severityscore', 'priorityscore', 'درجةالهشاشة', 'درجةالخطورة', 'درجةالأولوية'],
};

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./\\()[\]{}]/g, '');

const findValue = (row: Record<string, unknown>, key: keyof DashboardRow) => {
  const match = Object.keys(row).find((header) => aliases[key].includes(normalizeHeader(header)));
  return match ? row[match] : undefined;
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value ?? '')
    .replace(/[٬،,]/g, '')
    .replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDate = (value: unknown, index: number) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const decoded = XLSX.SSF.parse_date_code(value);
    if (decoded) {
      const month = String(decoded.m).padStart(2, '0');
      const day = String(decoded.d).padStart(2, '0');
      return `${decoded.y}-${month}-${day}`;
    }
  }
  const parsed = new Date(String(value ?? ''));
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date(2025, index % 12, 1).toISOString().slice(0, 10);
};

const inferStatus = (
  beneficiaries: number,
  targetBeneficiaries: number,
  urgentCases: number,
  pendingCases: number,
) => {
  const coverage = targetBeneficiaries ? beneficiaries / targetBeneficiaries : 1;
  if (pendingCases === 0 && coverage >= 0.95) return 'Completed';
  if (coverage < 0.7 || urgentCases > Math.max(10, beneficiaries * 0.15)) return 'Needs attention';
  return 'Active';
};

export function parseWorkbook(bytes: Uint8Array): DashboardRow[] {
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('The file does not contain a data sheet.');

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: '',
    raw: true,
  });
  if (!rawRows.length) throw new Error('The data sheet is empty.');

  const rows = rawRows
    .map((raw, index): DashboardRow | null => {
      const beneficiaries = Math.max(0, toNumber(findValue(raw, 'beneficiaries')));
      const households = Math.max(0, toNumber(findValue(raw, 'households')));
      const targetBeneficiaries = Math.max(
        beneficiaries,
        toNumber(findValue(raw, 'targetBeneficiaries'), beneficiaries),
      );
      const urgentCases = Math.max(0, toNumber(findValue(raw, 'urgentCases')));
      const deliveredCases = Math.max(
        0,
        toNumber(findValue(raw, 'deliveredCases'), households || beneficiaries),
      );
      const pendingCases = Math.max(0, toNumber(findValue(raw, 'pendingCases')));
      const aidAmount = Math.max(0, toNumber(findValue(raw, 'aidAmount')));
      if (!beneficiaries && !targetBeneficiaries && !aidAmount) return null;

      return {
        date: toDate(findValue(raw, 'date'), index),
        region: String(findValue(raw, 'region') || 'Unspecified').trim(),
        aidType: String(findValue(raw, 'aidType') || 'General Assistance').trim(),
        program: String(findValue(raw, 'program') || `Program ${index + 1}`).trim(),
        partner: String(findValue(raw, 'partner') || 'Unspecified').trim(),
        status:
          String(findValue(raw, 'status') || '').trim() ||
          inferStatus(beneficiaries, targetBeneficiaries, urgentCases, pendingCases),
        beneficiaries,
        households,
        aidAmount,
        targetBeneficiaries,
        urgentCases,
        deliveredCases,
        pendingCases,
        vulnerabilityScore: Math.min(
          100,
          Math.max(0, toNumber(findValue(raw, 'vulnerabilityScore'), 50)),
        ),
      };
    })
    .filter((row): row is DashboardRow => row !== null);

  if (!rows.length) {
    throw new Error('No Beneficiaries, Target Beneficiaries, or Aid Amount data was found.');
  }
  return rows;
}

const seeded = (seed: number) => {
  const x = Math.sin(seed * 999) * 10000;
  return x - Math.floor(x);
};

export function createSampleData(): DashboardRow[] {
  const aidTypes = ['Food Security', 'Shelter', 'Health', 'WASH'];
  const programs = ['Emergency Food Basket', 'Safe Shelter', 'Mobile Health', 'Clean Water Access'];
  const regions = ['North District', 'Central District', 'Coastal District', 'Border District'];
  const partners = ['Relief Network', 'Hope Foundation', 'Community Aid', 'Health Alliance'];
  const rows: DashboardRow[] = [];

  for (let month = 0; month < 12; month += 1) {
    for (let type = 0; type < aidTypes.length; type += 1) {
      const seed = month * 11 + type * 17 + 3;
      const target = 420 + Math.round(seeded(seed) * 850);
      const coverageRatio = 0.58 + seeded(seed + 1) * 0.44;
      const beneficiaries = Math.round(target * coverageRatio);
      const households = Math.max(1, Math.round(beneficiaries / (4.3 + seeded(seed + 2))));
      const urgentCases = Math.round(target * (0.035 + seeded(seed + 3) * 0.13));
      const pendingCases = Math.round(target * Math.max(0, 1 - coverageRatio) * 0.42);
      const deliveredCases = Math.max(0, households - Math.round(pendingCases / 4.5));
      const aidAmount = beneficiaries * (38 + type * 27 + seeded(seed + 4) * 52);
      const vulnerabilityScore = Math.round(48 + seeded(seed + 5) * 48);

      rows.push({
        date: new Date(2025, month, 5 + type * 4).toISOString().slice(0, 10),
        region: regions[(month + type) % regions.length],
        aidType: aidTypes[type],
        program: programs[type],
        partner: partners[(month * 2 + type) % partners.length],
        status: inferStatus(beneficiaries, target, urgentCases, pendingCases),
        beneficiaries,
        households,
        aidAmount,
        targetBeneficiaries: target,
        urgentCases,
        deliveredCases,
        pendingCases,
        vulnerabilityScore,
      });
    }
  }
  return rows;
}

export function uniqueValues(
  rows: DashboardRow[],
  key: 'region' | 'aidType' | 'status',
) {
  return [ALL, ...Array.from(new Set(rows.map((row) => row[key]))).sort()];
}

function periodStart(rows: DashboardRow[], period: DashboardFilters['period']) {
  if (period === ALL || !rows.length) return null;
  const months = period === 'Last 3 months' ? 3 : period === 'Last 6 months' ? 6 : 12;
  const maxDate = new Date(Math.max(...rows.map((row) => new Date(row.date).getTime())));
  maxDate.setMonth(maxDate.getMonth() - months + 1);
  maxDate.setDate(1);
  return maxDate;
}

export function filterRows(rows: DashboardRow[], filters: DashboardFilters) {
  const start = periodStart(rows, filters.period);
  return rows.filter((row) => {
    if (filters.region !== ALL && row.region !== filters.region) return false;
    if (filters.aidType !== ALL && row.aidType !== filters.aidType) return false;
    if (filters.status !== ALL && row.status !== filters.status) return false;
    if (start && new Date(row.date) < start) return false;
    return true;
  });
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function aggregateData(rows: DashboardRow[], filters: DashboardFilters) {
  const beneficiaries = sum(rows.map((row) => row.beneficiaries));
  const households = sum(rows.map((row) => row.households));
  const aidAmount = sum(rows.map((row) => row.aidAmount));
  const urgentCases = sum(rows.map((row) => row.urgentCases));
  const deliveredCases = sum(rows.map((row) => row.deliveredCases));
  const pendingCases = sum(rows.map((row) => row.pendingCases));
  const baseTarget = sum(rows.map((row) => row.targetBeneficiaries));
  const targetBeneficiaries = baseTarget + (filters.includePending ? pendingCases : 0);
  const coverageRate = targetBeneficiaries ? (beneficiaries / targetBeneficiaries) * 100 : 0;
  const deliveryRate =
    deliveredCases + pendingCases ? (deliveredCases / (deliveredCases + pendingCases)) * 100 : 0;
  const averageAid = beneficiaries ? aidAmount / beneficiaries : 0;

  const dated = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const midpoint = Math.ceil(dated.length / 2);
  const older = sum(dated.slice(0, midpoint).map((row) => row.beneficiaries));
  const newer = sum(dated.slice(midpoint).map((row) => row.beneficiaries));
  const growth = older ? ((newer - older) / older) * 100 : 0;

  const groupBeneficiaries = (keyFor: (row: DashboardRow) => string) => {
    const map = new Map<string, number>();
    rows.forEach((row) => {
      const key = keyFor(row);
      map.set(key, (map.get(key) || 0) + row.beneficiaries);
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  };

  const trend = groupBeneficiaries((row) => row.date.slice(0, 7))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-12);
  const categories = groupBeneficiaries((row) => row.aidType).slice(0, 6);
  const channels = groupBeneficiaries((row) => row.region).slice(0, 6);

  const programMap = new Map<
    string,
    { beneficiaries: number; target: number; urgent: number; aidAmount: number; vulnerability: number; rows: number }
  >();
  rows.forEach((row) => {
    const item = programMap.get(row.program) || {
      beneficiaries: 0,
      target: 0,
      urgent: 0,
      aidAmount: 0,
      vulnerability: 0,
      rows: 0,
    };
    item.beneficiaries += row.beneficiaries;
    item.target += row.targetBeneficiaries;
    item.urgent += row.urgentCases;
    item.aidAmount += row.aidAmount;
    item.vulnerability += row.vulnerabilityScore;
    item.rows += 1;
    programMap.set(row.program, item);
  });
  const programs = [...programMap.entries()]
    .map(([name, item]) => ({
      name,
      beneficiaries: item.beneficiaries,
      coverage: item.target ? (item.beneficiaries / item.target) * 100 : 0,
      urgent: item.urgent,
      aidAmount: item.aidAmount,
      priorityScore:
        item.target - item.beneficiaries +
        (filters.prioritizeUrgent ? item.urgent * 3 : item.urgent) +
        item.vulnerability / Math.max(1, item.rows),
    }))
    .sort((a, b) =>
      filters.prioritizeUrgent
        ? b.priorityScore - a.priorityScore
        : b.beneficiaries - a.beneficiaries,
    )
    .slice(0, 5);

  const regionStats = new Map<
    string,
    { reached: number; target: number; urgent: number; pending: number; amount: number }
  >();
  rows.forEach((row) => {
    const item = regionStats.get(row.region) || {
      reached: 0,
      target: 0,
      urgent: 0,
      pending: 0,
      amount: 0,
    };
    item.reached += row.beneficiaries;
    item.target += row.targetBeneficiaries;
    item.urgent += row.urgentCases;
    item.pending += row.pendingCases;
    item.amount += row.aidAmount;
    regionStats.set(row.region, item);
  });
  const regions = [...regionStats.entries()].map(([name, item]) => ({
    name,
    ...item,
    coverage: item.target ? (item.reached / item.target) * 100 : 0,
    aidPerPerson: item.reached ? item.amount / item.reached : 0,
  }));
  const lowestCoverage = [...regions].sort((a, b) => a.coverage - b.coverage)[0];
  const highestUrgency = [...regions].sort((a, b) => b.urgent - a.urgent)[0];
  const lowestAid = [...regions].sort((a, b) => a.aidPerPerson - b.aidPerPerson)[0];

  const insights: Insight[] = [
    {
      title: coverageRate >= 90 ? 'Coverage is on track' : 'Coverage gap detected',
      body: `${coverageRate.toFixed(1)}% of the current beneficiary target has been reached.`,
      tone: coverageRate >= 90 ? 'positive' : 'warning',
    },
    {
      title: 'Urgent caseload',
      body: `${urgentCases.toLocaleString('en-US')} urgent cases are recorded${
        highestUrgency ? `, with the highest concentration in ${highestUrgency.name}` : ''
      }.`,
      tone: urgentCases > beneficiaries * 0.12 ? 'warning' : 'info',
    },
    {
      title: growth >= 0 ? 'Reach is increasing' : 'Reach has slowed',
      body: `Beneficiary reach changed by ${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% versus the previous half.`,
      tone: growth >= 0 ? 'positive' : 'warning',
    },
  ];

  const recommendations: Recommendation[] = [];
  if (lowestCoverage && lowestCoverage.coverage < 85) {
    recommendations.push({
      title: `Prioritize ${lowestCoverage.name}`,
      body: `Coverage is ${lowestCoverage.coverage.toFixed(1)}%. Review targeting, access constraints, and partner capacity.`,
      priority: 'High',
    });
  }
  if (pendingCases > 0) {
    recommendations.push({
      title: 'Reduce the pending caseload',
      body: `${pendingCases.toLocaleString('en-US')} cases are pending. Assign a short-term clearance target and track completion weekly.`,
      priority: pendingCases > deliveredCases * 0.25 ? 'High' : 'Medium',
    });
  }
  if (lowestAid) {
    recommendations.push({
      title: `Review allocation in ${lowestAid.name}`,
      body: `Aid per reached beneficiary is ${filters.currency} ${lowestAid.aidPerPerson.toFixed(0)}. Compare this with needs severity and delivery costs before reallocating.`,
      priority: 'Medium',
    });
  }
  if (!recommendations.length) {
    recommendations.push({
      title: 'Maintain current delivery pace',
      body: 'Coverage and pending caseload are within acceptable thresholds. Continue weekly monitoring for emerging gaps.',
      priority: 'Monitor',
    });
  }

  return {
    beneficiaries,
    households,
    aidAmount,
    urgentCases,
    pendingCases,
    targetBeneficiaries,
    coverageRate,
    deliveryRate,
    averageAid,
    growth,
    categories,
    trend,
    channels,
    programs,
    insights,
    recommendations,
    scatter: rows.slice(0, 32).map((row) => ({
      x: row.vulnerabilityScore,
      y: row.beneficiaries ? row.aidAmount / row.beneficiaries : 0,
      label: `${row.region} · ${row.aidType}`,
    })),
  };
}

export const defaultFilters: DashboardFilters = {
  region: ALL,
  aidType: ALL,
  status: ALL,
  period: ALL,
  currency: 'USD',
  includePending: true,
  prioritizeUrgent: true,
  comparePrevious: true,
};

