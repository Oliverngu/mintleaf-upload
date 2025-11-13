// src/core/utils/errorToString.ts
export function errorToString(err: unknown): string {
  if (typeof err === "string") {
    return err;
  }
  if (err instanceof Error) {
    // This handles standard errors and FirebaseError which extends Error
    return err.message;
  }
  // A fallback for other error-like objects that might have a message or code property
  if (err && typeof err === 'object') {
    if ('message' in err && typeof (err as any).message === 'string' && (err as any).message) {
      return (err as any).message;
    }
    if ('code' in err && typeof (err as any).code === 'string' && (err as any).code) {
      return `An error occurred: ${(err as any).code}`;
    }
  }
  
  // Final, safe fallback for anything else. Avoids JSON.stringify.
  return "An unexpected error occurred. Check the console for more details.";
}
