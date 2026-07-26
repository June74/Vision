# Background jobs

This folder coordinates scheduled Vision tasks through focused interfaces. Calendar maintenance uses opaque Queue
work, while daily recovery captures raw encrypted database rows, wraps the archive with a separate key, verifies R2,
and then applies retention.
