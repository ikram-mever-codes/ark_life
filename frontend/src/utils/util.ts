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
