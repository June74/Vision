# validate-preview-acceptance-window

Stops a temporary preview candidate from being prepared or deployed during
the protected period around normal daily recovery work. It can also validate
the exact expiry stamped into the generated candidate.

## `plainObject`

Accepts only a normal data object from the candidate file.

## `dataValue`

Reads one ordinary own property without invoking a getter.

## `main`

With no arguments, validates the selected operation and checks its full
selector-specific lifetime. With the fixed candidate flag, it derives the
selector from the generated artifact and checks that exact expiry immediately
before deployment. It prints only a fixed safe result.
