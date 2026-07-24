# Synchronization domain

The synchronization domain owns closed contracts between provider adapters and later job or repository layers. It deliberately carries protected payloads separately from queryable event facts, so a repository can encrypt the former before storage. Provider-specific parsing and network behavior stay outside this folder.
