import type { DutyNote } from "@/lib/pricing/duty";
import { fmt } from "./config";
import type { Messages } from "./messages";

/** Renders a duty note; older saved analyses stored plain English strings. */
export function dutyNoteText(t: Messages, note: DutyNote | string): string {
  if (typeof note === "string") return note;
  return fmt(t.dutyNotes[note.code], note.vars);
}
