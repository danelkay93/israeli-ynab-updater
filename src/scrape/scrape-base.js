import moment from 'moment';
import { SCRAPERS, createScraper } from '../helpers/scrapers';

const ERROR_TYPES = new Set(['INVALID_PASSWORD', 'ACCOUNT_BLOCKED', 'CHANGE_PASSWORD',
  'TIMEOUT', 'GENERAL_ERROR', 'GENERIC', 'TWO_FACTOR_RETRIEVER_MISSING', 'AUTOMATION_BLOCKED']);

export default async function scrape(scraperId, credentials, options) {
  const { combineInstallments, startDate, showBrowser } = options;
  const scraperName = SCRAPERS[scraperId] ? SCRAPERS[scraperId].name : null;
  if (!scraperName) throw new Error('UNKNOWN_SCRAPER');
  let result;
  try {
    const scraper = createScraper({ companyId: scraperId, startDate, combineInstallments, showBrowser, verbose: false });
    result = await scraper.scrape(credentials);
  } catch (_) {
    throw new Error('SCRAPER_FAILED');
  }
  if (!result || !result.success) {
    throw new Error(result && ERROR_TYPES.has(result.errorType) ? result.errorType : 'SCRAPER_FAILED');
  }
  if (!Array.isArray(result.accounts)) throw new Error('INVALID_SCRAPER_RESPONSE');
  const warnings = ['UPSTREAM_COMPLETENESS_UNVERIFIED'];
  // The reviewed scraper source reports known gaps only as completeness.status
  // and issues. The locked 3.6.0 artifact is unreviewed and may supply neither.
  const completeness = result.completeness || {};
  const issues = Array.isArray(completeness.issues) ? completeness.issues : [];
  if (completeness.status === 'partial' || issues.length) warnings.push('UPSTREAM_PARTIAL');
  const accounts = result.accounts.map((account) => {
    if (!Array.isArray(account.txns)) throw new Error('INVALID_SCRAPER_RESPONSE');
    const txns = [];
    account.txns.forEach((txn) => {
      const dateMoment = moment(txn.date);
      const amount = txn.type !== 'installments' || !combineInstallments ? txn.chargedAmount : txn.originalAmount;
      if (!txn.date || !dateMoment.isValid() || typeof amount !== 'number' || !Number.isFinite(amount)) {
        warnings.push('INVALID_TRANSACTION_OMITTED');
        return;
      }
      txns.push({
        company: scraperName, account: account.accountNumber, dateMoment,
        payee: txn.description, status: txn.status, amount,
        installment: txn.installments ? txn.installments.number : null,
        total: txn.installments ? txn.installments.total : null,
      });
    });
    return { scraperId, scraperName, accountNumber: account.accountNumber, txns };
  });
  return { accounts, warnings: [...new Set(warnings)] };
}
