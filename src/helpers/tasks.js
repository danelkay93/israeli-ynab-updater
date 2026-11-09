import path from 'path';
import colors from 'colors/safe';
import moment from 'moment';
import {
  writeJsonFile,
  readJsonFile,
  getFolderFiles,
  deleteFile,
} from './files';
import { TASKS_FOLDER } from '../definitions';
import { SCRAPERS } from './scrapers';

function writeSummaryLine(key, value) {
  console.log(`- ${colors.bold(key)}: ${value}`);
}

function printTaskSummary(taskData, shouldCalculateStartDate = false) {
  if (taskData) {
    const scrapers = taskData.scrapers || [];
    const {
      dateDiffByMonth,
      combineInstallments,
    } = taskData.options;
    const {
      combineReport,
      saveLocation,
      includeFutureTransactions,
      includePendingTransactions,
    } = taskData.output;
    console.log(colors.underline.bold('Task Summary'));
    writeSummaryLine('Scrapers', scrapers.map((scraper) => SCRAPERS[scraper.id].name).join(', '));

    if (shouldCalculateStartDate) {
      const substractValue = dateDiffByMonth - 1;
      const startMoment = moment().subtract(substractValue, 'month').startOf('month');
      writeSummaryLine('Start scraping from', startMoment.format('ll'));
    } else {
      writeSummaryLine('Scrape # of months', dateDiffByMonth);
    }

    writeSummaryLine('Combine installments', combineInstallments ? 'Yes' : 'No');
    writeSummaryLine('Save to location', saveLocation);
    writeSummaryLine('Create single report', combineReport ? 'Yes' : 'No');
    writeSummaryLine('Include future Transactions', includeFutureTransactions ? 'Yes' : 'No');
    writeSummaryLine('Include pending Transactions', includePendingTransactions ? 'Yes' : 'No');
  }
}

class TasksManager {
  async getTasksList() {
    const files = await getFolderFiles(TASKS_FOLDER, '.json');
    const result = files.map((file) => path.basename(file, '.json'));
    return result;
  }

  async hasTask(taskName) {
    const tasksList = await this.getTasksList();
    return taskName && !!tasksList.find((taskListName) => {
      return taskListName.toLowerCase() === taskName.toLowerCase();
    });
  }

  isValidTaskName(taskName) {
    return typeof taskName === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(taskName) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(taskName);
  }

  async loadTask(taskName) {
    if (this.isValidTaskName(taskName) && await this.hasTask(taskName)) {
      return readJsonFile(`${TASKS_FOLDER}/${taskName}.json`);
    }

    throw new Error(`failed to find a task named ${taskName}`);
  }

  async saveTask(taskName, taskData) {
    if (taskName && this.isValidTaskName(taskName)) {
      return writeJsonFile(`${TASKS_FOLDER}/${taskName}.json`, taskData);
    }

    throw new Error(`invalid task name provided ${taskName}`);
  }

  async deleteTask(taskName) {
    if (this.isValidTaskName(taskName) && await this.hasTask(taskName)) {
      await deleteFile(`${TASKS_FOLDER}/${taskName}.json`);
    } else {
      throw new Error(`invalid task name provided ${taskName}`);
    }
  }
}

export { TasksManager, printTaskSummary };
