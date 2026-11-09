import path from 'path';
import crypto from 'crypto';
import { DATE_TIME_FORMAT } from '../constants';
import safeError from '../helpers/safe-error';
import moment from 'moment';
import inquirer from 'inquirer';

import { CONFIG_FOLDER } from '../definitions';
import { readJsonFile, writeJsonFile } from '../helpers/files';
import { decryptCredentials } from '../helpers/credentials';
import { SCRAPERS } from '../helpers/scrapers';
import { readSettingsFile, writeSettingsFile } from '../helpers/settings';
import scrape from './scrape-base';
import { generateSeparatedReports } from './generate-reports';

async function getParameters() {
  const settings = await readSettingsFile();
  const {
    combineInstallments,
    saveLocation,
    includeFutureTransactions,
    includePendingTransactions,
  } = settings;

  const startOfMonthMoment = moment().startOf('month');
  const monthOptions = [];
  for (let i = 0; i < 6; i += 1) {
    const monthMoment = startOfMonthMoment.clone().subtract(i, 'month');
    monthOptions.push({
      name: monthMoment.format('ll'),
      value: monthMoment,
    });
  }
  const result = await inquirer.prompt([
    {
      type: 'list',
      name: 'scraperId',
      message: 'Which bank would you like to scrape?',
      choices: Object.keys(SCRAPERS).map((id) => {
        return {
          name: SCRAPERS[id].name,
          value: id,
        };
      }),
    },
    {
      type: 'confirm',
      name: 'combineInstallments',
      message: 'Combine installment transactions?',
      default: !!combineInstallments,
    },
    {
      type: 'list',
      name: 'startDate',
      message: 'What date would you like to start scraping from?',
      choices: monthOptions,
    },
    {
      type: 'input',
      name: 'saveLocation',
      message: 'Save folder?',
      default: saveLocation,
    },
    {
      type: 'confirm',
      name: 'includeFutureTransactions',
      message: 'Include future transactions?',
      default: !!includeFutureTransactions,
    },
    {
      type: 'confirm',
      name: 'includePendingTransactions',
      message: 'Include pending transactions?',
      default: !!includePendingTransactions,
    },
  ]);

  settings.combineInstallments = result.combineInstallments;
  settings.startDate = result.startDate;
  settings.saveLocation = result.saveLocation;
  settings.includeFutureTransactions = result.includeFutureTransactions;
  settings.includePendingTransactions = result.includePendingTransactions;
  await writeSettingsFile(settings);

  return result;
}

export default async function scrapeIndividual(showBrowser) {
  const { scraperId, combineInstallments, startDate, saveLocation: root,
    includeFutureTransactions, includePendingTransactions } = await getParameters();
  const saveLocation = path.join(root, moment().format(DATE_TIME_FORMAT) + '-' + crypto.randomBytes(8).toString('hex'));
  const status = { requestedSources: 1, successfulSources: [], failures: [],
    warnings: ['UPSTREAM_COMPLETENESS_UNVERIFIED'], complete: false };
  await writeJsonFile(path.join(saveLocation, 'run-status.json'), { ...status, exportFinished: false });
  let accounts = [];
  try {
    const encrypted = await readJsonFile(path.join(CONFIG_FOLDER, scraperId + '.json'));
    if (!encrypted) throw new Error('CONFIG_READ_FAILED');
    const credentials = await decryptCredentials(encrypted);
    credentials.otpCodeRetriever = async () => {
      const { otpCode } = await inquirer.prompt([
        { type: 'password', mask: '*', name: 'otpCode', message: 'Enter OTP code:' },
      ]);
      return otpCode;
    };
    const read = await scrape(scraperId, credentials, { startDate: startDate.toDate(), combineInstallments, showBrowser });
    accounts = read.accounts;
    status.successfulSources.push(0);
    status.warnings = read.warnings;
  } catch (error) {
    const code = safeError(error);
    status.failures.push({ sourceIndex: 0, code });
    console.error('Source failed:', code);
    process.exitCode = 1;
  }
  await generateSeparatedReports(accounts, saveLocation, includeFutureTransactions, includePendingTransactions, status);
  await writeJsonFile(path.join(saveLocation, 'run-status.json'), { ...status, exportFinished: true });
}
