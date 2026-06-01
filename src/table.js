/**
 * Table rendering for the `--output table` mode (human-friendly, optional colors).
 *
 * Dependency-free: colors are ANSI escapes and are only emitted when the caller
 * says so (the caller decides based on TTY / NO_COLOR). Two layouts:
 *   - list result (array, or a `{ data: [...] }` list object) => one row per item
 *   - single object                                          => field/value rows
 * Long or nested values are compacted/truncated; use --output json for the full
 * data. Wide tables drop trailing columns to fit the terminal width.
 */

const ANSI = {
  reset: '[0m',
  bold: '[1m',
  dim: '[2m',
  red: '[31m',
  green: '[32m',
  yellow: '[33m',
  cyan: '[36m',
};

const MAX_COL = 36;
const SEP = '  ';

// Columns shown first (when present) so the most useful fields are never dropped.
const PREFERRED = [
  'id', 'object', 'type', 'status', 'state', 'mode', 'livemode',
  'amount', 'amount_total', 'currency', 'name', 'email', 'description', 'created',
];

function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\[[0-9;]*m/g, '');
}

function makeStyle(enabled) {
  return (text, code) => (enabled && code ? `${code}${text}${ANSI.reset}` : text);
}

function truncate(text, max) {
  if (max <= 0) return '';
  if (text.length <= max) return text;
  if (max === 1) return '…';
  return `${text.slice(0, max - 1)}…`;
}

function pad(styled, plainLen, width, alignRight) {
  const space = ' '.repeat(Math.max(0, width - plainLen));
  return alignRight ? `${space}${styled}` : `${styled}${space}`;
}

/**
 * Formats a single value into { plain, styled } where `plain` is the visible
 * text (already truncated to maxWidth) and `styled` adds color.
 */
function formatCell(value, style, maxWidth) {
  if (value === undefined || value === null) {
    return { plain: '—', styled: style('—', ANSI.dim) };
  }
  if (typeof value === 'boolean') {
    const t = String(value);
    return { plain: t, styled: style(t, value ? ANSI.green : ANSI.red) };
  }
  if (typeof value === 'number') {
    const t = truncate(String(value), maxWidth);
    return { plain: t, styled: style(t, ANSI.yellow) };
  }
  if (typeof value === 'string') {
    const t = truncate(value, maxWidth);
    return { plain: t, styled: t };
  }
  let raw;
  if (Array.isArray(value) && value.every((x) => x === null || ['string', 'number', 'boolean'].includes(typeof x))) {
    raw = value.join(', ');
  } else {
    raw = JSON.stringify(value);
  }
  const t = truncate(raw, maxWidth);
  return { plain: t, styled: style(t, ANSI.dim) };
}

function columnsFor(rows) {
  const seen = new Set();
  const cols = [];
  PREFERRED.forEach((k) => {
    if (rows.some((r) => r && typeof r === 'object' && k in r)) {
      cols.push(k);
      seen.add(k);
    }
  });
  rows.forEach((r) => {
    if (r && typeof r === 'object') {
      Object.keys(r).forEach((k) => {
        if (!seen.has(k)) {
          cols.push(k);
          seen.add(k);
        }
      });
    }
  });
  return cols;
}

function renderRows(rows, style, termWidth, footer) {
  const cols = columnsFor(rows);
  const cells = rows.map((r) => cols.map((c) => formatCell(r ? r[c] : undefined, style, MAX_COL)));

  const widths = cols.map((c, i) => {
    let w = Math.min(c.length, MAX_COL);
    cells.forEach((row) => { w = Math.max(w, row[i].plain.length); });
    return w;
  });
  const numericCol = cols.map((c) => {
    let sawNumber = false;
    const ok = rows.every((r) => {
      const v = r ? r[c] : undefined;
      if (typeof v === 'number') sawNumber = true;
      return v === undefined || v === null || typeof v === 'number';
    });
    return ok && sawNumber;
  });

  // Greedily include columns until the terminal width budget runs out.
  const include = [];
  let budget = termWidth;
  for (let i = 0; i < cols.length; i += 1) {
    const need = widths[i] + (include.length ? SEP.length : 0);
    if (include.length && budget - need < 0) break;
    budget -= need;
    include.push(i);
  }
  const dropped = cols.length - include.length;

  const header = include
    .map((i) => pad(style(truncate(cols[i], widths[i]), ANSI.bold), Math.min(cols[i].length, widths[i]), widths[i], numericCol[i]))
    .join(SEP);
  const rule = include
    .map((i) => style('─'.repeat(widths[i]), ANSI.dim))
    .join(SEP);
  const body = cells.map((row) => include
    .map((i) => pad(row[i].styled, row[i].plain.length, widths[i], numericCol[i]))
    .join(SEP)).join('\n');

  const notes = [`${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`];
  if (dropped > 0) notes.push(`+${dropped} more ${dropped === 1 ? 'column' : 'columns'} (use --output json)`);
  footer.forEach((f) => notes.push(f));

  return `${header}\n${rule}\n${body}\n${style(notes.join('  ·  '), ANSI.dim)}`;
}

function renderObject(obj, style, termWidth, footer) {
  const entries = Object.entries(obj);
  if (entries.length === 0) return style('(empty object)', ANSI.dim);

  const keyWidth = Math.min(24, entries.reduce((w, [k]) => Math.max(w, k.length), 'field'.length));
  const valWidth = Math.max(10, termWidth - keyWidth - SEP.length);

  const header = `${pad(style('field', ANSI.bold), 'field'.length, keyWidth, false)}${SEP}${style('value', ANSI.bold)}`;
  const rule = `${style('─'.repeat(keyWidth), ANSI.dim)}${SEP}${style('─'.repeat(Math.min(valWidth, 24)), ANSI.dim)}`;
  const body = entries.map(([k, v]) => {
    const key = pad(style(truncate(k, keyWidth), ANSI.bold), Math.min(k.length, keyWidth), keyWidth, false);
    return `${key}${SEP}${formatCell(v, style, valWidth).styled}`;
  }).join('\n');

  const tail = footer.length ? `\n${style(footer.join('  ·  '), ANSI.dim)}` : '';
  return `${header}\n${rule}\n${body}${tail}`;
}

/**
 * Renders a result as a table. `color` enables ANSI colors.
 */
function renderTable(result, { color = false } = {}) {
  const style = makeStyle(color);
  const termWidth = (process.stdout && process.stdout.columns) || 80;

  if (result === null || typeof result !== 'object') {
    return String(result);
  }

  const footer = [];
  let rows = null;
  if (Array.isArray(result)) {
    rows = result;
  } else if (Array.isArray(result.data)) {
    rows = result.data;
    if (typeof result.total_count === 'number') footer.push(`total_count: ${result.total_count}`);
    if (result.has_more === true) footer.push('has_more: true');
  }

  if (rows) {
    if (rows.length === 0) return style('(empty list)', ANSI.dim);
    if (rows.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
      return renderRows(rows, style, termWidth, footer);
    }
    return rows.map((r) => formatCell(r, style, termWidth).styled).join('\n');
  }

  return renderObject(result, style, termWidth, footer);
}

module.exports = { renderTable, stripAnsi };
