export const useCheck = (
  obj: object,
  emailKey: string,
  passwordKey: string,
  setToster: (state: boolean) => void,
  setMessage: (message: string) => void,
) => {
  for (let [key, value] of Object.entries(obj)) {
    if (key == emailKey) {
      if (!value.trim()) {
        setToster(true);
        setMessage(`${key} required`);
        return true;
      }

      const regEx = /^[a-zA-Z][^@\s]*@[^@\s]+\.com$/;
      if (!regEx.test(value.trim())) {
        setToster(true);
        setMessage("Invalid Email");
        return true;
      }

      const checkAt = value.match(/@/g) ?? [];
      const checkCom = value.match(/\.com/g) ?? [];

      if (checkAt.length > 1 || checkCom.length > 1) {
        setToster(true);
        setMessage("Invalid Email");
        return true;
      }
    } else {
      if (!value.trim()) {
        setToster(true);
        setMessage(`${key} required`);
        return true;
      }
    }
  }

  return false;
};
