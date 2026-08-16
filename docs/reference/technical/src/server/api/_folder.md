# Server API routes

Coordinates authenticated sessions, CSRF validation, strict request schemas, repositories, provider adapters, safe errors, and allowlisted audit facts.

Phase C routes resolve owner, connected calendar, token, and provider version
from server-side boundaries. Browser bodies carry only the narrow one-off event
proposal or exact confirmation phrase; authority-bearing identities never come
from the browser.
