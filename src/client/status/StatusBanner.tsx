/** Presents short live setup outcomes without exposing provider or security detail. */
import type { JSX } from "react";

/** Announces the current user-facing setup outcome to assistive technology. */
export function StatusBanner({ message, tone = "neutral" }: { readonly message: string; readonly tone?: "neutral" | "warning" }): JSX.Element {
  return <p className={`status-banner status-banner--${tone}`} role="status">{message}</p>;
}
