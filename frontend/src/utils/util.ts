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
