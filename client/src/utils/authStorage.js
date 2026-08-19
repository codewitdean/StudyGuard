const authTokenKey = "studyguard.authToken";

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function getStoredAuthToken() {
  return getStorage()?.getItem(authTokenKey) ?? "";
}

export function storeAuthToken(token) {
  getStorage()?.setItem(authTokenKey, token);
}

export function clearStoredAuthToken() {
  getStorage()?.removeItem(authTokenKey);
}
