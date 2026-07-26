# Client binding boundary

This file is the single list of Vision configuration names that may or may not appear in browser code.

Server credentials, private-user identifiers, provider keys, database addresses, restore targets, and deployment credentials are client-forbidden. Non-secret runtime setting names are classified separately so adding a new runtime binding forces an explicit decision in the security tests.
