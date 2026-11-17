export const useCheck = (
  obj: object,
  emailKey: string,
  passwordKey: string,
  setToster: (state: boolean) => void,
  setMessage: (message: string) => void,
) => {
  for (let [key, value] of Object.entries(obj)) {
    // Basic requirement check for all fields
    if (!value || !value.trim()) {
      setToster(true);
      setMessage(`${key} required`);
      return true;
    }

    if (key === emailKey) {
      // Standard Email Regex: allows dots in name, multiple domains, etc.
      const regEx = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      if (!regEx.test(value.trim())) {
        setToster(true);
        setMessage("Invalid Email");
        return true;
      }

      // Removed the checkAt and checkCom manual counts.
      // The Regex above already ensures there is exactly one '@'
      // and a valid domain structure.
    }

    // You can add a specific check for password length here if needed
    if (key === passwordKey) {
      if (value.length < 6) {
        setToster(true);
        setMessage("Password must be at least 6 characters");
        return true;
      }
    }
  }

  return false;
};

/**
 * Convert an AI reply (Markdown) into plain text for captions and
 * text-to-speech: removes **bold**, headings, table pipes, code marks and
 * separator lines so the voice does not read symbols aloud.
 */
/** Rough language guess so spoken notes match the reply language. */
const isItalian = (text: string) =>
  /\b(il|della|delle|sono|non|che|per|tuoi|esami|valori)\b/i.test(text);

/** Max characters read aloud; longer answers say "the rest is on screen". */
export const MAX_SPOKEN_CHARS = 1500;

/**
 * Turn an AI reply (Markdown) into what the voice should say:
 * tables are not read cell by cell (a short note is spoken instead), Markdown
 * symbols are removed, and very long answers are cut at a sentence boundary.
 */
export const prepareSpeech = (md: string): string => {
  const it = isItalian(md);
  const tableNote = it
    ? "Ho riportato i valori in una tabella sullo schermo."
    : "I've put the values in a table on screen.";
  // Replace each Markdown table block (consecutive lines starting with |).
  const withoutTables = (md || "").replace(
    /(?:^[ \t]*\|.*\|?[ \t]*(?:\r?\n|$))+/gm,
    `${tableNote}\n`,
  );
  let speech = markdownToSpeech(withoutTables);
  if (speech.length > MAX_SPOKEN_CHARS) {
    const cut = speech.slice(0, MAX_SPOKEN_CHARS);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
    speech =
      (end > MAX_SPOKEN_CHARS * 0.5 ? cut.slice(0, end + 1) : cut) +
      (it
        ? " Il resto della risposta è sullo schermo."
        : " The rest of the answer is on screen.");
  }
  return speech;
};

/**
 * Split speech into chunks for streaming playback: a short first chunk so
 * the voice starts quickly, then larger chunks fetched while playing.
 */
export const splitForSpeech = (
  text: string,
  firstMax = 180,
  restMax = 420,
): string[] => {
  const sentences = (text || "")
    .split(/(?<=[.!?…:;])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    const limit = chunks.length === 0 ? firstMax : restMax;
    if (cur && (cur + " " + s).length > limit) {
      chunks.push(cur);
      cur = s;
    } else {
      cur = cur ? `${cur} ${s}` : s;
    }
    // A single very long sentence: hard-split at a space.
    while (cur.length > restMax) {
      const at = cur.lastIndexOf(" ", restMax);
      const idx = at > 40 ? at : restMax;
      chunks.push(cur.slice(0, idx));
      cur = cur.slice(idx).trim();
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
};

export const markdownToSpeech = (md: string): string =>
  (md || "")
    .replace(/^\s*\|?\s*:?-{2,}.*$/gm, "") // table separator rows / ---
    .replace(/^\s*-{3,}\s*$/gm, "")
    .replace(/\|/g, ", ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|\s)[*_](\S[^*_]*\S|\S)[*_](?=\s|$|[.,;:!?])/g, "$1$2")
    .replace(/^\s*[*-]\s+/gm, "")
    .replace(/[📄💡]/gu, "")
    .replace(/(,\s*){2,}/g, ", ")
    .replace(/^\s*,\s*|\s*,\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
