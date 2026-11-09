import path from 'path';
import crypto from 'crypto';
import safeError from '../helpers/safe-error';
import { writeJsonFile } from '../helpers/files';
import moment from 'moment';
import inquirer from 'inquirer';
import colors from 'colors/safe';
import { DATE_TIME_FORMAT } from '../constants';
import { decryptCredentials } from '../helpers/credentials';
import scrape from './scrape-base';
import { TasksManager, printTaskSummary } from '../helpers/tasks';
import {
  generateSingleReport,
  generateSeparatedReports,
} from './generate-reports';

const tasksManager = new TasksManager();

async function getParameters() {
  const availableTasks = await tasksManager.getTasksList();

  if (availableTasks && availableTasks.length) {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'taskName',
        message: 'Select a task to execute',
        validate: (answer) => {
          if (!answer) {
            return 'Task name must be provided';
          }
          return true;
        },
        choices: [...availableTasks],
      },
    ]);

    return { taskName: answers.taskName };
  }

  console.log(
    colors.notify(
      "No tasks created, please run command 'npm run setup' to create a task"
    )
  );
  return { taskName: null };
}

export default async function scrapeTask(showBrowser) {
  const { taskName } = await getParameters();
  if (!taskName) return;
  const taskData = await tasksManager.loadTask(taskName);
  const scrapersOfTask = taskData.scrapers || [];
  if (!scrapersOfTask.length) {
    console.log('Task has no scrapers configured.');
    return;
  }
  printTaskSummary(taskData, true);
  const { dateDiffByMonth, combineInstallments } = taskData.options;
  if (!Number.isInteger(dateDiffByMonth) || dateDiffByMonth < 1 || dateDiffByMonth > 120) {
    throw new Error('INVALID_TASK_DATE_RANGE');
  }
  const { combineReport, saveLocation: root, includeFutureTransactions, includePendingTransactions } = taskData.output;
  const startDate = moment().subtract(dateDiffByMonth - 1, 'month').startOf('month').toDate();
  const saveLocation = path.join(root, 'tasks', taskName,
    moment().format(DATE_TIME_FORMAT) + '-' + crypto.randomBytes(8).toString('hex'));
  const status = { requestedSources: scrapersOfTask.length, successfulSources: [], failures: [],
    warnings: ['UPSTREAM_COMPLETENESS_UNVERIFIED'], complete: false };
  // Fail before bank login if the export destination cannot be created.
  await writeJsonFile(path.join(saveLocation, 'run-status.json'), { ...status, exportFinished: false });
  const reportAccounts = [];
  for (let i = 0; i < scrapersOfTask.length; i += 1) {
    try {
      const source = scrapersOfTask[i];
      const credentials = await decryptCredentials(source.credentials);
      credentials.otpCodeRetriever = async () => {
        const { otpCode } = await inquirer.prompt([
          { type: 'password', mask: '*', name: 'otpCode', message: 'Enter OTP code:' },
        ]);
        return otpCode;
      };
      const read = await scrape(source.id, credentials, { startDate, combineInstallments, showBrowser });
      reportAccounts.push(...read.accounts);
      status.successfulSources.push(i);
      status.warnings.push(...read.warnings);
    } catch (error) {
      const code = safeError(error);
      status.failures.push({ sourceIndex: i, code });
      console.error('Source failed:', code);
    }
  }
  status.warnings = [...new Set(status.warnings)];
  try {
    if (combineReport) {
      await generateSingleReport(reportAccounts, saveLocation, includeFutureTransactions, includePendingTransactions, status);
    } else {
      await generateSeparatedReports(reportAccounts, saveLocation, includeFutureTransactions, includePendingTransactions, status);
    }
    await writeJsonFile(path.join(saveLocation, 'run-status.json'), { ...status, exportFinished: true });
  } catch (_) {
    await writeJsonFile(path.join(saveLocation, 'run-status.json'), { ...status, exportFinished: false, exportError: 'EXPORT_FAILED' });
    throw new Error('EXPORT_FAILED');
  }
  if (status.failures.length) process.exitCode = 1;
}
