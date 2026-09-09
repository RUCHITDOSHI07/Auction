export function firebaseErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
    return code ? `${code}: ${error.message}` : error.message;
  }

  return "An unknown Firebase error occurred.";
}

export function rethrowFirebaseError(operation: string, error: unknown): never {
  throw new Error(`${operation}: ${firebaseErrorMessage(error)}`, { cause: error });
}
