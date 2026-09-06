export interface PasswordValidationResult {
  isValid: boolean;
  hasMinLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
  errorMessage?: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  const hasMinLength = password.length >= 8;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  const isValid = hasMinLength && hasLowercase && hasUppercase && hasDigit && hasSymbol;

  let errorMessage: string | undefined;
  if (!password) {
    errorMessage = "Password is required.";
  } else if (!hasMinLength) {
    errorMessage = "Password must be at least 8 characters long.";
  } else if (!hasLowercase) {
    errorMessage = "Password must contain at least one lowercase letter.";
  } else if (!hasUppercase) {
    errorMessage = "Password must contain at least one uppercase letter.";
  } else if (!hasDigit) {
    errorMessage = "Password must contain at least one number.";
  } else if (!hasSymbol) {
    errorMessage = "Password must contain at least one symbol (e.g. !@#$%^&*).";
  }

  return {
    isValid,
    hasMinLength,
    hasLowercase,
    hasUppercase,
    hasDigit,
    hasSymbol,
    errorMessage,
  };
}
