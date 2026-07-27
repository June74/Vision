# print-safe-tail

Reads a live Cloudflare tail stream and prints only a privacy-safe
scheduled-backup result. With the fixed `--restore-only` option, it skips
recovery results until a closed restore result arrives. It never copies raw
logs, URLs, object names, or provider-controlled error text into release
evidence. Any other command-line form is rejected without output.
