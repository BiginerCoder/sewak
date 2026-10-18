export function safeAuthRedirect(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || value.startsWith("/api/")) {
    return "/";
  }
  if (value === "/login" || value === "/signup") return "/";
  return value;
}
