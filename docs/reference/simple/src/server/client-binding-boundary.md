# Client binding boundary

This file is the single list of Vision configuration names that may or may not appear in browser code.

Server credentials, private-user identifiers, provider keys, database addresses, restore targets, and deployment credentials are client-forbidden. Non-secret runtime setting names are classified separately so adding a new runtime binding forces an explicit decision in the security tests.

The temporary preview-restore fields, acceptance selector, and AI attestation
belong to the runtime client-forbidden list. Their names may appear in the
server-only Worker bundle, but neither their names nor their values may enter a
browser asset. The complete eight-selector value vocabulary is also forbidden
from browser assets.
