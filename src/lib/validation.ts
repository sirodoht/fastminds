export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUsername(username: string): string | null {
  if (!username || typeof username !== "string") {
    return "Username is required";
  }
  if (username.length < 3) {
    return "Username must be at least 3 characters";
  }
  if (username.length > 30) {
    return "Username must be at most 30 characters";
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return "Username can only contain letters, numbers, underscores, and hyphens";
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email || typeof email !== "string") {
    return "Email is required";
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Invalid email address";
  }
  return null;
}

export function validateUUID(id: string): string | null {
  if (!id || typeof id !== "string") {
    return "ID is required";
  }
  if (!UUID_REGEX.test(id)) {
    return "Invalid ID format";
  }
  return null;
}
