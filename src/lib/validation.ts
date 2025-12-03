const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIAL_REGEX = /[!@#$%^&*()[\]{}\-_+=~`|:;"'<>,.?/]/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: unknown): { valid: boolean; message?: string; value?: string } {
  if (typeof email !== "string") return { valid: false, message: "Email is required." };
  const normalized = normalizeEmail(email);
  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, message: "Enter a valid email address." };
  }
  return { valid: true, value: normalized };
}

export function validateName(name: unknown): { valid: boolean; message?: string; value?: string } {
  if (typeof name !== "string") return { valid: false, message: "Name is required." };
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { valid: false, message: "Name must be at least 2 characters." };
  }
  if (trimmed.length > 60) {
    return { valid: false, message: "Name must be shorter than 60 characters." };
  }
  return { valid: true, value: trimmed };
}

export function validatePasswordBasic(password: unknown): { valid: boolean; message?: string; value?: string } {
  if (typeof password !== "string") return { valid: false, message: "Password is required." };
  const trimmed = password.trim();
  if (trimmed.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters." };
  }
  return { valid: true, value: trimmed };
}

export function validatePasswordStrong(password: unknown): { valid: boolean; message?: string; value?: string } {
  const basic = validatePasswordBasic(password);
  if (!basic.valid || !basic.value) return basic;

  const value = basic.value;
  if (!/[A-Z]/.test(value)) return { valid: false, message: "Add at least one uppercase letter." };
  if (!/[a-z]/.test(value)) return { valid: false, message: "Add at least one lowercase letter." };
  if (!/[0-9]/.test(value)) return { valid: false, message: "Add at least one number." };
  if (!SPECIAL_REGEX.test(value)) return { valid: false, message: "Add at least one special character." };

  return { valid: true, value };
}
