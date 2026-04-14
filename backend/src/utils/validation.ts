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
  const regEx = /^[a-zA-Z][^@\s]*@[^@\s]+\.com$/;

  if (!regEx.test(email.trim())) return false;

  const checkAt = email.match(/@/g) ?? [];
  const checkCom = email.match(/\.com/g) ?? [];

  if (checkAt.length > 1 || checkCom.length > 1) return false;

  return true;
};

export const useCheckOnPassword = (password: string): boolean => {
  if (password.length < 6) return false;

  return true;
};
