/** Renders the Vision-local capture, Today, task, and note desk without implicit calendar writes. */
import { useEffect, useMemo, useState, type FormEvent, type JSX } from "react";
import type { BrowserSession } from "../setup/api";
import {
  createSecretaryCapture,
  createSecretaryNote,
  createSecretaryTask,
  readSecretaryToday,
  transitionSecretaryTask,
  type SecretaryCapture,
  type SecretaryNote,
  type SecretaryTask,
  type SecretaryToday,
} from "./api";

/** Owns local secretary state while keeping calendar changes outside this surface. */
export function SecretaryDesk({ session }: { readonly session: BrowserSession }): JSX.Element {
  const [today, setToday] = useState<SecretaryToday | null>(null);
  const [capture, setCapture] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);

  useEffect(() => {
    let active = true;
    void readSecretaryToday(timeZone)
      .then((value) => { if (active) setToday(value); })
      .catch(() => { if (active) setError("Local secretary is unavailable."); });
    return () => { active = false; };
  }, [timeZone]);

  /** Stores one local capture and surfaces calendar candidates as pending only. */
  async function submitCapture(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const stored = await createSecretaryCapture(session, capture);
      setToday((current) => current ? { ...current, captures: [stored, ...current.captures] } : current);
      setCapture("");
      setMessage(stored.kind === "calendar_candidate"
        ? "Calendar candidate — approval required"
        : stored.kind === "ambiguous" ? "Capture saved — clarification needed" : "Capture saved locally");
    } catch {
      setError("Capture could not be saved.");
    }
  }

  /** Creates one local task with no provider side effect. */
  async function submitTask(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const task = await createSecretaryTask(session, {
        title: taskTitle,
        dueAt: null,
        timeZone,
      });
      setToday((current) => current ? { ...current, tasks: [...current.tasks, task] } : current);
      setTaskTitle("");
      setMessage("Task saved locally");
    } catch {
      setError("Task could not be saved.");
    }
  }

  /** Creates one protected local note. */
  async function submitNote(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const note = await createSecretaryNote(session, { title: noteTitle, body: noteBody });
      setToday((current) => current ? { ...current, notes: [note, ...current.notes] } : current);
      setNoteTitle("");
      setNoteBody("");
      setMessage("Note saved locally");
    } catch {
      setError("Note could not be saved.");
    }
  }

  /** Applies a verified local task transition to the visible Today projection. */
  async function changeTask(task: SecretaryTask): Promise<void> {
    setError(null);
    try {
      const next = await transitionSecretaryTask(session, task.id, task.status === "open" ? "complete" : "undo");
      setToday((current) => current ? {
        ...current,
        tasks: current.tasks.map((candidate) => candidate.id === next.id ? next : candidate),
      } : current);
    } catch {
      setError("Task transition could not be saved.");
    }
  }

  return (
    <section className="secretary-desk" aria-label="Local secretary">
      <div className="secretary-desk__intro">
        <p className="desk-intro__eyebrow">Vision-local workspace</p>
        <h2>Local secretary</h2>
        <p>Capture, tasks, and notes stay in Vision. Calendar changes always require a separate reviewed approval.</p>
      </div>
      {error ? <p className="secretary-desk__error">{error}</p> : null}
      {message ? <p className="secretary-desk__message" role="status">{message}</p> : null}
      <form className="secretary-form" onSubmit={submitCapture}>
        <label htmlFor="secretary-capture">Capture something</label>
        <textarea id="secretary-capture" value={capture} onChange={(event) => setCapture(event.target.value)} placeholder="task: review the paper" />
        <button className="button button--primary" type="submit" disabled={capture.trim().length === 0}>Save capture</button>
      </form>
      <div className="secretary-desk__columns">
        <section aria-labelledby="secretary-today-heading">
          <p className="desk-intro__eyebrow">Today {today ? `· ${today.dateKey}` : ""}</p>
          <h3 id="secretary-today-heading">Your local Today</h3>
          <ul className="secretary-list">
            {today?.tasks.map((task) => (
              <li key={task.id}>
                <span className={task.status === "completed" ? "secretary-list__done" : undefined}>{task.title}</span>
                <button className="button button--quiet" type="button" onClick={() => void changeTask(task)}>
                  {task.status === "open" ? "Complete" : "Undo"}
                </button>
              </li>
            ))}
          </ul>
          {today?.events.length ? <p className="secretary-desk__quiet">Calendar events shown here are read-only.</p> : null}
        </section>
        <section aria-labelledby="secretary-task-heading">
          <h3 id="secretary-task-heading">Add a task</h3>
          <form className="secretary-form" onSubmit={submitTask}>
            <label htmlFor="secretary-task-title">Task title</label>
            <input id="secretary-task-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
            <button className="button button--quiet" type="submit" disabled={taskTitle.trim().length === 0}>Add task</button>
          </form>
        </section>
      </div>
      <form className="secretary-form secretary-form--note" onSubmit={submitNote}>
        <h3>Protected note</h3>
        <label htmlFor="secretary-note-title">Note title</label>
        <input id="secretary-note-title" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
        <label htmlFor="secretary-note-body">Note body</label>
        <textarea id="secretary-note-body" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} />
        <button className="button button--quiet" type="submit" disabled={noteTitle.trim().length === 0 || noteBody.trim().length === 0}>Save note</button>
      </form>
      <CaptureLedger captures={today?.captures ?? []} />
      <NoteLedger notes={today?.notes ?? []} />
    </section>
  );
}

/** Renders capture outcomes without offering a calendar confirmation button. */
function CaptureLedger({ captures }: { readonly captures: readonly SecretaryCapture[] }): JSX.Element | null {
  if (captures.length === 0) return null;
  return (
    <div className="secretary-ledger" aria-label="Recent captures">
      <h3>Recent captures</h3>
      <ul>
        {captures.slice(0, 5).map((capture) => (
          <li key={capture.id}>
            <span>{capture.content}</span>
            {capture.kind === "calendar_candidate"
              ? <><strong>Calendar candidate — approval required</strong><small>No calendar change was confirmed.</small></>
              : capture.kind === "ambiguous" ? <small>Needs clarification</small> : <small>Saved locally</small>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Renders protected notes only after the authenticated API returns them. */
function NoteLedger({ notes }: { readonly notes: readonly SecretaryNote[] }): JSX.Element | null {
  if (notes.length === 0) return null;
  return (
    <div className="secretary-ledger" aria-label="Recent notes">
      <h3>Recent notes</h3>
      <ul>{notes.slice(0, 5).map((note) => <li key={note.id}><strong>{note.title}</strong><span>{note.body}</span></li>)}</ul>
    </div>
  );
}
