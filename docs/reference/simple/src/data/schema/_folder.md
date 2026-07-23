# `src/data/schema`

These files describe Vision's database tables. They keep identities and sync tokens in separate columns and use binary storage for encrypted content.

The reviewed SQL migration is the source for a hand-written test manifest covering all eight tables. Tests compare both the live Drizzle definitions and the retained generated snapshot with that list, including every column, key, relationship, and rule. The expected list is never generated from Drizzle, because doing that would copy a mistake into both sides of the check.
