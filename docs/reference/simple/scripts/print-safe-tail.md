# print-safe-tail

Reads a live Cloudflare tail stream and prints only the first privacy-safe
scheduled-backup result. It never copies raw logs, URLs, object names, or
provider-controlled error text into release evidence.
