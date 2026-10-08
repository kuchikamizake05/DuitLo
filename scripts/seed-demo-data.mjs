import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Dry run by default. --apply inserts only deterministic, separately marked demo rows.
const email = process.argv.find((arg) => arg.startsWith('--email='))?.slice(8).toLowerCase();
const apply = process.argv.includes('--apply');
assert(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Provide --email=<existing account email>');
process.loadEnvFile('.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && key, 'Supabase server credentials are required');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const marker = 'fintrack-demo-2026-08-to-2026-10-v1';
const matches = [];
let scannedAllUsers = false;
for (let page = 1; page <= 100; page++) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error(error.message);
  matches.push(...data.users.filter((user) => user.email?.toLowerCase() === email));
  if (data.users.length < 100) { scannedAllUsers = true; break; }
}
assert(scannedAllUsers && matches.length === 1, 'Expected exactly one existing target user');
const userId = matches[0].id;
function id(label) {
  const chars = createHash('sha256').update(`${marker}:${userId}:${label}`).digest('hex').slice(0, 32).split('');
  chars[12] = '5'; chars[16] = '8';
  const value = chars.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
const accounts = [
  { name: 'BCA Utama (Demo)', institution: 'BCA', kind: 'bank', current_balance: 6000000 },
  { name: 'Mandiri Tabungan (Demo)', institution: 'Mandiri', kind: 'bank', current_balance: 8000000 },
  { name: 'GoPay Harian (Demo)', institution: 'GoPay', kind: 'ewallet', current_balance: 7000000 },
].map((account, index) => ({ ...account, id: id(`account-${index}`), user_id: userId, currency: 'IDR', is_active: true, created_at: '2026-08-01T00:00:00+07:00' }));
const categorySpecs = [
  ['Gaji', 'income', 'BriefcaseBusiness', '#15803d'], ['Freelance', 'income', 'Laptop', '#047857'],
  ['Makanan', 'expense', 'Utensils', '#f59e0b'], ['Transportasi', 'expense', 'Car', '#0ea5e9'],
  ['Belanja', 'expense', 'ShoppingBag', '#8b5cf6'], ['Tagihan', 'expense', 'Receipt', '#ef4444'],
  ['Hiburan', 'expense', 'Gamepad2', '#ec4899'], ['Kesehatan', 'expense', 'HeartPulse', '#14b8a6'],
];
const categories = categorySpecs.map(([name, type, icon, color]) => ({ id: id(`category-${name}`), user_id: userId, name: `${name} (Demo)`, type, icon, color }));
const transactions = [];
function add(date, tag, accountIndex, type, category, amount, merchant, status = 'confirmed') {
  transactions.push({ id: id(`transaction-${date}-${tag}`), user_id: userId, account_id: accounts[accountIndex].id,
    date, type, category: `${category} (Demo)`, amount, merchant: `[DEMO] ${merchant}`, source: 'manual', status,
    note: `${marker} | Data ilustrasi, bukan transaksi nyata.`,
    created_at: `${date}T12:00:00+07:00`, updated_at: `${date}T12:00:00+07:00` });
}
for (let month = 8; month <= 10; month++) {
  const maxDay = month === 10 ? 12 : new Date(Date.UTC(2026, month, 0)).getUTCDate();
  for (let day = 1; day <= maxDay; day++) {
    const date = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    add(date, 'meal', 2, 'expense', 'Makanan', 22000 + ((day * 7 + month) % 9) * 5000, ['Makan siang', 'Kopi dan sarapan', 'Makan malam'][day % 3]);
    if (day % 2 === 0) add(date, 'transport', 2, 'expense', 'Transportasi', 12000 + (day % 5) * 6000, 'Transportasi harian');
    if (day % 7 === 0) add(date, 'groceries', 0, 'expense', 'Belanja', 180000 + (day % 3) * 75000, 'Belanja kebutuhan mingguan');
    if (day % 10 === 0) add(date, 'entertainment', 2, 'expense', 'Hiburan', 95000 + month * 10000, 'Nonton dan rekreasi');
    if (day === 1) add(date, 'salary', 0, 'income', 'Gaji', 8500000 + (month - 8) * 250000, 'Gaji bulanan');
    if (day === 2) add(date, 'rent', 0, 'expense', 'Tagihan', 1800000, 'Sewa tempat tinggal');
    if (day === 5) add(date, 'internet', 0, 'expense', 'Tagihan', 325000, 'Internet bulanan');
    if (day === 7) add(date, 'electricity', 0, 'expense', 'Tagihan', 250000 + (month - 8) * 25000, 'Listrik bulanan');
    if (day === 11) add(date, 'health', 0, 'expense', 'Kesehatan', 125000, 'Vitamin dan kesehatan');
    if (day === 15) add(date, 'freelance', 1, 'income', 'Freelance', month === 8 ? 1500000 : 2250000, 'Pendapatan proyek freelance');
  }
}
add('2026-10-11', 'review', 2, 'expense', 'Makanan', 72000, 'Makan bersama teman - perlu ditinjau', 'needs_review');
add('2026-10-12', 'pending', 0, 'expense', 'Belanja', 350000, 'Belanja online - menunggu persetujuan', 'pending_approval');
const budgetSpecs = [['Makanan', 2000000], ['Transportasi', 650000], ['Belanja', 1500000], ['Tagihan', 2500000], ['Hiburan', 500000], ['Kesehatan', 400000]];
const budgets = [8, 9, 10].flatMap((month) => budgetSpecs.map(([category, limit]) => ({ id: id(`budget-${month}-${category}`), user_id: userId, category: `${category} (Demo)`, month: `2026-${String(month).padStart(2, '0')}-01`, limit_amount: limit })));
const goals = [
  { name: 'Dana darurat (Demo)', target_amount: 30000000, current_amount: 12500000, color: '#15803d', due_date: '2027-03-01' },
  { name: 'Laptop baru (Demo)', target_amount: 18000000, current_amount: 7200000, color: '#0ea5e9', due_date: '2027-01-01' },
  { name: 'Liburan (Demo)', target_amount: 10000000, current_amount: 3500000, color: '#8b5cf6', due_date: '2027-06-01' },
].map((goal, index) => ({ ...goal, id: id(`goal-${index}`), user_id: userId, currency: 'IDR', is_active: true }));
const tables = { financial_accounts: accounts, categories, financial_budgets: budgets, financial_goals: goals, transactions };
for (const rows of Object.values(tables)) {
  assert(new Set(rows.map((row) => row.id)).size === rows.length);
  assert(rows.every((row) => row.user_id === userId));
}
assert(transactions.every((row) => row.date >= '2026-08-01' && row.date <= '2026-10-12' && row.amount > 0));
const monthly = {};
for (const row of transactions) {
  const month = row.date.slice(0, 7);
  monthly[month] ??= { count: 0, income: 0, expense: 0, review: 0 };
  monthly[month].count++;
  if (row.status === 'confirmed') monthly[month][row.type] += row.amount;
  else monthly[month].review++;
}
const before = {};
for (const [table, rows] of Object.entries(tables)) {
  const { data, error } = await client.from(table).select('*').eq('user_id', userId).order('id').limit(1000);
  if (error) throw new Error(`${table}: ${error.message}`);
  assert(data.length < 1000, 'Existing data exceeds preflight snapshot limit');
  const seedIds = new Set(rows.map((row) => row.id));
  before[table] = data.filter((row) => !seedIds.has(row.id));
}
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', target: email, marker, counts: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])), monthly }));
if (apply) {
  for (const [table, rows] of Object.entries(tables)) {
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error(`${table}: ${error.message}; rerun safely with the same IDs after resolving the error`);
  }
  for (const [table, rows] of Object.entries(tables)) {
    const { data, error } = await client.from(table).select('*').eq('user_id', userId).order('id').limit(1000);
    if (error) throw new Error(`${table}: ${error.message}`);
    const seedIds = new Set(rows.map((row) => row.id));
    const actual = data.filter((row) => seedIds.has(row.id));
    assert.equal(actual.length, rows.length, `${table}: verify inserted row count`);
    assert.deepEqual(data.filter((row) => !seedIds.has(row.id)), before[table], `${table}: existing data must be unchanged`);
    if (table === 'financial_accounts') for (const account of accounts) {
      const net = transactions.filter((row) => row.account_id === account.id && row.status === 'confirmed').reduce((sum, row) => sum + (row.type === 'income' ? row.amount : -row.amount), 0);
      assert.equal(Number(actual.find((row) => row.id === account.id).current_balance), account.current_balance + net, 'Account balance must match ledger trigger totals');
    }
    console.log(JSON.stringify({ table, verifiedDemoRows: actual.length, preservedExistingRows: before[table].length }));
  }
}
