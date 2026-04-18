export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePassword = (
  password: string,
): { valid: boolean; message?: string } => {
  if (password.length < 6) {
    return { valid: false, message: "Password must be at least 6 characters" };
  }
  return { valid: true };
};

export const useCheckOnEmail = (email: string): boolean => {
  if (!email) return false;

  // Standard Email Regex:
  // 1. Allows alphanumeric, dots, underscores, plus, and hyphens before the @
  // 2. Ensures exactly one @
  // 3. Allows multiple domain segments (e.g., mail.co.uk or gmail.com)
  // 4. Ensures the TLD (end part) is at least 2 characters long (.com, .io, .ai)
  const regEx = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  return regEx.test(email.trim());
};

export const useCheckOnPassword = (password: string): boolean => {
  if (password.length < 6) return false;

  return true;
};
