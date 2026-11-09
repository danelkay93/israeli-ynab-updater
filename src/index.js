import safeError from './helpers/safe-error';
import yargs from 'yargs';
import colors from 'colors/safe';
import setupMainMenu from './setup/setup-main-menu';
import scrapingMainMenu from './scrape/scraping-main-menu';

// set theme
colors.setTheme({
  title: 'bgCyan',
  notify: 'magenta',
});

const args = yargs.options({
  mode: {
    alias: 'm',
    describe: 'mode for running',
  },
  show: {
    alias: 's',
    describe: 'show browser while scraping',
    type: 'boolean',
    default: false,
  },
}).help().argv;

async function main() {
  if (!args.mode || args.mode === 'scrape') await scrapingMainMenu(args.show);
  else if (args.mode === 'setup') await setupMainMenu();
  else throw new Error('INVALID_MODE');
}
main().catch((error) => {
  console.error(safeError(error));
  process.exitCode = 1;
});
