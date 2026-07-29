# validate-preview-acceptance-window

Stops a temporary preview candidate from being prepared or deployed during
the protected period around normal daily recovery work. It can also validate
the exact expiry stamped into the generated candidate.

## `plainObject`

Accepts only a normal data object from the candidate file.

## `dataValue`

Reads one ordinary own property without invoking a getter.

## `main`

With no arguments, checks whether a fresh maximum candidate lifetime is safe.
With the fixed candidate flag, checks the generated expiry immediately before
deployment. It prints only a fixed safe result.
