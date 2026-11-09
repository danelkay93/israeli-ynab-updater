# Israeli YNAB Updater

Exports bank transactions as CSV using israeli-bank-scrapers. This candidate contains bounded source corrections only. No dependency installation, integration execution or live validation was performed.

## Runtime and dependency boundary

The lockfile still selects israeli-bank-scrapers 3.6.0 and Puppeteer 6.0.0, and its integrity values match the npm registry's for those releases. The official israeli-bank-scrapers 3.6.0 tarball was downloaded as inert data, and its SHA-512 matches both the registry and this lockfile (SHA-256 `35970bebad7aa5c46c6d6ba1125fb984e3e8925cae85faca59a57e3484711519`); Puppeteer 6.0.0 is identified only by the lockfile's registry-matching value. That establishes which artifacts are locked, not that they were reviewed: both are public, but neither one's contents or source was reviewed here. Their old browser/runtime support is an unresolved blocker to live use. No unreviewed upgrade or replacement lockfile is claimed as a fix. The locked scraper declares Node >=14.14.0; that is a historical minimum, **not** a recommendation to run that obsolete release. Conflicting Node 10/14 pins were removed.

The separately reviewed scraper source is a different major line and does not reach this tool. Release 6.12.2's registry `gitHead` is that source's upstream commit and its tarball's SHA-512 matches the registry, but no reproducible build ties the tarball to the commit. It declares no `completeness`, and no published release contains the review's scraper corrections. The declared range `^3.6.0` cannot select 6.x: without the lockfile, a fresh resolution would pick 3.10.3, which is also unreviewed.

Upgrade gate, none of it performed:

1. Choose one exact scraper artifact (a registry release, or a package built from the reviewed source) and review it.
2. Check every use this tool makes of it: the `createScraper` options (`companyId`, `startDate`, `combineInstallments`, `showBrowser`, `verbose`), `SCRAPERS[id].name`, the `loginFields` under which setup saved credentials, the `otpCodeRetriever` callback, and the result fields `success`, `errorType`, `completeness`, `accounts[].accountNumber` and `txns[]` (`date`, `type`, `status`, `description`, `chargedAmount`, `originalAmount`, `installments`).
3. Move to a Node release that satisfies that artifact's `engines` (6.12.2 declares >=22.22.2), and confirm that the Babel 6 toolchain behind `npm start` runs on it.
4. Change the declared range, then generate and review a new lockfile in a separately authorized dependency step.
5. Run the offline checks under Remaining verification.

Until then, do not describe this tool as running the reviewed scraper or its fixes.

## Credential storage contract

Setup prompts locally for a separate passphrase (at least 12 characters, confirmed). Credential values use versioned scrypt-derived AES-256-GCM envelopes with random salts and IVs and authentication tags. The passphrase is requested again when decrypting; it is not written to disk, put in command arguments or cached by this application. Keep it separately in your own password manager. Forgetting it requires re-entering the bank credentials.

Old hardcoded-key ciphertext is rejected with `LEGACY_CREDENTIALS_REENTER_REQUIRED`. Re-enter credentials through setup for each saved scraper and task; there is no automatic legacy decryption/migration. Remove obsolete copies/backups locally when appropriate.

Configuration and report files use exclusive temporary files, atomic rename and POSIX 0600 file modes; directories are created recursively with 0700. Windows needs an owner-only directory ACL; POSIX modes do not establish that ACL. Neither exports nor settings are encrypted. Protect the output directory and backups.

The existing commands remain `npm run setup`, `npm start` and `npm run start:debug` (visible browser). They no longer enable Node's inspector. This is a source contract, not approval to run the financial integrations.

## Export and failure contract

Each run uses a separate output directory. Task sources run independently: a failed source does not discard successful sources. Raw scraper messages, response bodies and exceptions are not logged. Status records contain only fixed failure codes and source indexes (zero-based positions in the task).

CSV text fields are neutralized for spreadsheet formulas, including whitespace/control prefixes. Financial amount cells remain validated numbers. Output filenames hash the full source/account/index tuple, so provider text cannot become a filesystem path. Task names reject traversal and Windows reserved names.

Every CSV has `Completeness`, `Warnings` and `Failed sources` columns. The accompanying `export-status.json` or `*.csv.status.json` records failures, warnings, export completion and row/file counts, including empty/all-failed results. `run-status.json` records the requested/successful source indexes and whether export finished. An unfinished record must not be treated as a successful export.

`complete` stays false: without evidenced upstream coverage, successful scraping is `unknown`, not guaranteed complete. Failures, invalid omitted transactions, or a scraper `completeness` status of `partial` or any reported completeness issue produce `partial`. That field is defined by the reviewed scraper source; the locked 3.6.0 artifact is not known to supply it. Check these fields before importing or reporting totals. The added CSV columns may need mapping in your importer. Failed sources set a nonzero exit status.

No automatic retry is performed. Inspect authentication failures before rerunning a task; a rerun otherwise logs in again to each configured source.

## Remaining verification

The locked 3.6.0 artifact's identity is verified but its contents have not been reviewed, and the new source paths have not been executed. Before any separate live-use decision, validate passphrase round trips/tamper rejection, old-format rejection, partial and empty export metadata, CSV-import compatibility, and platform-specific atomic file behavior with synthetic data in an authorized offline environment.
