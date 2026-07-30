# print-safe-tail

## `createPreviewTailObserver`
Creates a signal or uniqueness observer.
## `result`
Returns its fixed state.
## `push`
Admits one terminal.
## `finish`
Closes at the deadline.

## `--ai-usage-only`

Prints only one exact AI-usage acceptance record.

Reads a live Cloudflare tail stream and prints only a privacy-safe
scheduled-backup result. With the fixed `--restore-only` option, it skips
recovery results until a closed restore result arrives. It never copies raw
logs, URLs, object names, or provider-controlled error text into release
evidence. With `--role-probe-only`, it rejects both recovery and restore
evidence until an exact role-probe result arrives. Any other command-line form
is rejected without output. With `--calendar-maintenance-only`, it waits for
one exact normal 15-minute maintenance result. With `--foundation-probe-only`,
it waits for one exact closed Phase B foundation result.
