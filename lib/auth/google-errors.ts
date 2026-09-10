export function firebaseAuthCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    return String((error as { code: string }).code);
  }
  return "";
}

export function isGoogleSignInCancelled(error: unknown) {
  const code = firebaseAuthCode(error);
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
}

export function googleSignInErrorMessage(error: unknown) {
  const code = firebaseAuthCode(error);
  const fallback =
    typeof error === "object" && error && "error" in error && typeof error.error === "string"
      ? error.error
      : error instanceof Error
        ? error.message
        : "Sign-in failed.";

  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in popup. Allow popups for this site, then try again.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for Google sign-in. Add it under Firebase Authentication → Settings → Authorized domains.";
    case "auth/operation-not-allowed":
      return "Google sign-in is disabled in Firebase Authentication. Enable the Google provider.";
    case "auth/account-exists-with-different-credential":
      return "This email is already used with a different sign-in method.";
    case "auth/network-request-failed":
      return "Network error during Google sign-in. Check your connection and try again.";
    case "auth/internal-error":
      return "Google sign-in could not complete. Check Firebase Auth configuration and try again.";
    default:
      return fallback;
  }
}
