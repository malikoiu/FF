import * as XLSX from 'xlsx';

export type DashboardRow = {
  date: string;
  category: string;
  region: string;
  channel: string;
  product: string;
  representative: string;
  sales: number;
  orders: number;
  returns: number;
  cost: number;
  quantity: number;
  price: number;
};

export type DashboardFilters = {
  region: string;
  category: string;
  channel: string;
  period: 'All' | 'Last 3 months' | 'Last 6 months' | 'Last 12 months';
  includeVat: boolean;
  excludeReturns: boolean;
  comparePrevious: boolean;
};

const ALL = 'All';

const aliases: Record<keyof DashboardRow, string[]> = {
  date: ['date', 'orderdate', 'transactiondate', 'التاريخ', 'تاريخ', 'تاريخالطلب'],
  category: ['category', 'segment', 'الفئة', 'التصنيف', 'القسم'],
  region: ['region', 'area', 'city', 'المنطقة', 'المدينة'],
  channel: ['channel', 'source', 'القناة', 'المصدر'],
  product: ['product', 'productname', 'item', 'المنتج', 'اسمالمنتج', 'الصنف'],
  representative: ['representative', 'rep', 'salesrep', 'employee', 'المندوب', 'الموظف'],
  sales: ['sales', 'revenue', 'amount', 'total', 'المبيعات', 'الايرادات', 'الإيرادات', 'القيمة', 'الاجمالي', 'الإجمالي'],
  orders: ['orders', 'ordercount', 'transactions', 'الطلبات', 'عددالطلبات', 'العمليات'],
  returns: ['returns', 'refunds', 'returnamount', 'المرتجعات', 'المسترجع'],
  cost: ['cost', 'cogs', 'التكلفة', 'التكاليف'],
  quantity: ['quantity', 'qty', 'units', 'الكمية', 'العدد'],
  price: ['price', 'unitprice', 'السعر', 'سعرالوحدة'],
};

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./\\()[\]{}]/g, '');

const findValue = (row: Record<string, unknown>, key: keyof DashboardRow) => {
  const match = Object.keys(row).find((header) =>
    aliases[key].includes(normalizeHeader(header)),
  );
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
  const fallback = new Date(2025, index % 12, 1);
  return fallback.toISOString().slice(0, 10);
};

export function parseWorkbook(bytes: Uint8Array): DashboardRow[] {
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('The file does not contain a data sheet.');

  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: '',
    raw: true,
  });
  if (!rawRows.length) throw new Error('The data sheet is empty.');

  const rows = rawRows
    .map((raw: Record<string, unknown>, index: number): DashboardRow | null => {
      const quantity = toNumber(findValue(raw, 'quantity'), 1);
      const price = toNumber(findValue(raw, 'price'));
      const explicitSales = toNumber(findValue(raw, 'sales'));
      const sales = explicitSales || price * quantity;
      if (!sales && !price) return null;

      return {
        date: toDate(findValue(raw, 'date'), index),
        category: String(findValue(raw, 'category') || 'Uncategorized').trim(),
        region: String(findValue(raw, 'region') || 'Unspecified').trim(),
        channel: String(findValue(raw, 'channel') || 'Unspecified').trim(),
        product: String(findValue(raw, 'product') || `Product ${index + 1}`).trim(),
        representative: String(findValue(raw, 'representative') || 'Unspecified').trim(),
        sales,
        orders: Math.max(1, toNumber(findValue(raw, 'orders'), 1)),
        returns: Math.max(0, toNumber(findValue(raw, 'returns'))),
        cost: Math.max(0, toNumber(findValue(raw, 'cost'), sales * 0.62)),
        quantity: Math.max(1, quantity),
        price: price || sales / Math.max(1, quantity),
      };
    })
    .filter((row: DashboardRow | null): row is DashboardRow => row !== null);

  if (!rows.length) {
    throw new Error('No Sales column or Price × Quantity values were found in the file.');
  }
  return rows;
}

const seeded = (seed: number) => {
  const x = Math.sin(seed * 999) * 10000;
  return x - Math.floor(x);
};

export function createSampleData(): DashboardRow[] {
  const categories = ['Electronics', 'Home Appliances', 'Accessories', 'Services'];
  const products = ['Device A', 'Device B', 'Accessory C', 'Service Pro'];
  const regions = ['Riyadh', 'Jeddah', 'Eastern Province'];
  const channels = ['Online', 'Store', 'Partners'];
  const rows: DashboardRow[] = [];

  for (let month = 0; month < 12; month += 1) {
    for (let category = 0; category < categories.length; category += 1) {
      const seed = month * 7 + category * 13 + 1;
      const quantity = 18 + Math.round(seeded(seed) * 70);
      const price = 180 + category * 210 + Math.round(seeded(seed + 1) * 240);
      const sales = quantity * price * (1 + month * 0.025);
      rows.push({
        date: new Date(2025, month, 4 + category * 4).toISOString().slice(0, 10),
        category: categories[category],
        region: regions[(month + category) % regions.length],
        channel: channels[(month * 2 + category) % channels.length],
        product: products[category],
        representative: ['Sarah', 'Mohammed', 'Nora'][(month + category * 2) % 3],
        sales,
        orders: Math.max(4, Math.round(quantity / 2.3)),
        returns: sales * (0.012 + seeded(seed + 2) * 0.035),
        cost: sales * (0.53 + seeded(seed + 3) * 0.16),
        quantity,
        price,
      });
    }
  }
  return rows;
}

export function uniqueValues(rows: DashboardRow[], key: 'region' | 'category' | 'channel') {
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
    if (filters.category !== ALL && row.category !== filters.category) return false;
    if (filters.channel !== ALL && row.channel !== filters.channel) return false;
    if (start && new Date(row.date) < start) return false;
    return true;
  });
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function aggregateData(rows: DashboardRow[], filters: DashboardFilters) {
  const vatMultiplier = filters.includeVat ? 1.15 : 1;
  const net = (row: DashboardRow) =>
    Math.max(0, row.sales * vatMultiplier - (filters.excludeReturns ? row.returns : 0));
  const revenue = sum(rows.map(net));
  const orders = sum(rows.map((row) => row.orders));
  const returns = sum(rows.map((row) => row.returns));
  const cost = sum(rows.map((row) => row.cost));
  const margin = revenue ? ((revenue - cost) / revenue) * 100 : 0;

  const dated = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const midpoint = Math.ceil(dated.length / 2);
  const older = sum(dated.slice(0, midpoint).map(net));
  const newer = sum(dated.slice(midpoint).map(net));
  const growth = older ? ((newer - older) / older) * 100 : 0;

  const group = (keyFor: (row: DashboardRow) => string) => {
    const map = new Map<string, number>();
    rows.forEach((row) => map.set(keyFor(row), (map.get(keyFor(row)) || 0) + net(row)));
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  };

  const trend = group((row) => row.date.slice(0, 7))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-12);
  const categories = group((row) => row.category).slice(0, 6);
  const channels = group((row) => row.channel).slice(0, 5);

  const productMap = new Map<string, { sales: number; cost: number; previous: number }>();
  dated.forEach((row, index) => {
    const item = productMap.get(row.product) || { sales: 0, cost: 0, previous: 0 };
    item.sales += net(row);
    item.cost += row.cost;
    if (index < midpoint) item.previous += net(row);
    productMap.set(row.product, item);
  });
  const products = [...productMap.entries()]
    .map(([name, item]) => ({
      name,
      sales: item.sales,
      margin: item.sales ? ((item.sales - item.cost) / item.sales) * 100 : 0,
      growth: item.previous ? ((item.sales - item.previous * 2) / (item.previous * 2)) * 100 : 0,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  return {
    revenue,
    orders,
    averageOrder: orders ? revenue / orders : 0,
    returnRate: revenue ? (returns / revenue) * 100 : 0,
    margin,
    growth,
    categories,
    trend,
    channels,
    products,
    scatter: rows.slice(0, 28).map((row) => ({
      x: row.quantity,
      y: row.price,
      label: row.product,
    })),
  };
}

export const defaultFilters: DashboardFilters = {
  region: ALL,
  category: ALL,
  channel: ALL,
  period: ALL,
  includeVat: false,
  excludeReturns: true,
  comparePrevious: true,
};

