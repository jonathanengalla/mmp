export const isEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
export const isLikelyUrl = (value: string) => /^https?:\/\//i.test(value) && (() => { try { new URL(value); return true; } catch { return false; } })();

export const validateRegistration = (data: {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  address?: string;
  linkedinUrl?: string;
  otherSocials?: string;
}) => {
  const errors: Record<string, string> = {};
  if (!data.email) errors.email = "Email is required";
  else if (!isEmail(data.email)) errors.email = "Email is invalid";
  if (!data.first_name) errors.first_name = "First name is required";
  if (!data.last_name) errors.last_name = "Last name is required";
  if (data.linkedinUrl && !isLikelyUrl(data.linkedinUrl)) errors.linkedinUrl = "LinkedIn URL must start with http(s) and be valid";
  return errors;
};

export const validateLogin = (data: { email: string; password: string }) => {
  const errors: Record<string, string> = {};
  if (!data.email) errors.email = "Email is required";
  else if (!isEmail(data.email)) errors.email = "Email is invalid";
  if (!data.password) errors.password = "Password is required";
  return errors;
};

/** Validate LinkedIn URL: must start with http(s) and contain linkedin.com */
export const isValidLinkedinUrl = (url: string): boolean => {
  if (!url) return true; // Empty is valid (optional field)
  return /^https?:\/\//i.test(url) && url.toLowerCase().includes("linkedin.com");
};

export const validateAdminCreateMember = (data: {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  address?: string;
  linkedinUrl?: string;
  otherSocials?: string;
}) => {
  const errors: Record<string, string> = {};
  if (!data.email) errors.email = "Email is required";
  else if (!isEmail(data.email)) errors.email = "Email is invalid";
  if (!data.first_name) errors.first_name = "First name is required";
  if (!data.last_name) errors.last_name = "Last name is required";
  if (data.linkedinUrl && !isValidLinkedinUrl(data.linkedinUrl)) {
    errors.linkedinUrl = "LinkedIn URL must start with http(s) and contain linkedin.com";
  }
  return errors;
};

