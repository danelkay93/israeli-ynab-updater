import { parse as objToCsv } from 'json2csv';
import colors from 'colors/safe';
import moment from 'moment';
import path from 'path';
import crypto from 'crypto';
import { DATE_TIME_FORMAT, TRANSACTION_STATUS } from '../constants';
import { writeFile, writeJsonFile } from '../helpers/files';

// Protect all text cells, including leading whitespace/control characters.
// Amounts stay numeric for import into YNAB.
function csvText(value) {
  const text = value == null ? '' : String(value);
  return /^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
}
function reportMetadata(metadata) {
  const details = metadata || { failures: [], warnings: ['UPSTREAM_COMPLETENESS_UNVERIFIED'] };
  return { ...details, complete: false,
    completeness: details.failures.length || details.warnings.some((w) => w !== 'UPSTREAM_COMPLETENESS_UNVERIFIED')
      ? 'partial' : 'unknown' };
}
function getReportFields(isSingleReport, metadata) {
  const fields = [
    { label: 'Date', value: (row) => row.dateMoment.format('DD/MM/YYYY') },
    { label: 'Payee', value: (row) => csvText(row.payee) },
    { label: 'Inflow', value: 'amount' },
    { label: 'Status', value: (row) => csvText(row.status) },
    { label: 'Installment', value: (row) => csvText(row.installment) },
    { label: 'Total', value: (row) => csvText(row.total) },
    { label: 'Completeness', value: () => metadata.completeness },
    { label: 'Warnings', value: () => csvText(metadata.warnings.join(';')) },
    { label: 'Failed sources', value: () => csvText(metadata.failures.map((failure) =>
      String(failure.sourceIndex) + ':' + failure.code).join(';')) },
  ];
  if (isSingleReport) fields.unshift(
    { label: 'Company', value: (row) => csvText(row.company) },
    { label: 'Account', value: (row) => csvText(row.account) },
  );
  return fields;
}
function filterTransactions(transactions, includeFutureTransactions, includePendingTransactions) {
  return transactions.filter((txn) =>
    (includeFutureTransactions || moment(txn.dateMoment).isSameOrBefore(moment(), 'day'))
    && (includePendingTransactions || txn.status !== TRANSACTION_STATUS.PENDING));
}
export async function generateSeparatedReports(
  scrapedAccounts, saveLocation, includeFutureTransactions, includePendingTransactions, metadata,
) {
  const summary = reportMetadata(metadata);
  const files = [];
  // Even an all-failed or empty export leaves an explicit status artifact.
  await writeJsonFile(path.join(saveLocation, 'export-status.json'), { ...summary, exportFinished: false });
  for (let i = 0; i < scrapedAccounts.length; i += 1) {
    const account = scrapedAccounts[i];
    const txns = filterTransactions(account.txns, includeFutureTransactions, includePendingTransactions);
    const key = crypto.createHash('sha256')
      .update(JSON.stringify([account.scraperId, account.accountNumber, i])).digest('hex');
    const name = 'account-' + key + '.csv';
    await writeFile(path.join(saveLocation, name), objToCsv(txns, { fields: getReportFields(true, summary), withBOM: true }));
    files.push({ file: name, exportedTransactions: txns.length });
  }
  await writeJsonFile(path.join(saveLocation, 'export-status.json'), { ...summary, exportFinished: true, files });
  console.log(colors.notify('Export finished; read export-status.json for completeness and failures.'));
}
export async function generateSingleReport(
  scrapedAccounts, saveLocation, includeFutureTransactions, includePendingTransactions, metadata,
) {
  const summary = reportMetadata(metadata);
  const txns = scrapedAccounts.reduce((all, account) => all.concat(
    filterTransactions(account.txns, includeFutureTransactions, includePendingTransactions)), []);
  const name = moment().format(DATE_TIME_FORMAT) + '-' + crypto.randomBytes(8).toString('hex') + '.csv';
  const filePath = path.join(saveLocation, name);
  await writeJsonFile(filePath + '.status.json', { ...summary, exportFinished: false });
  await writeFile(filePath, objToCsv(txns, { fields: getReportFields(true, summary), withBOM: true }));
  await writeJsonFile(filePath + '.status.json', { ...summary, exportFinished: true, exportedTransactions: txns.length });
  console.log(colors.notify('Export finished; read the CSV status sidecar for completeness and failures.'));
}
