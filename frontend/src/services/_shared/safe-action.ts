type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function safeAction<T>(
  fn: () => Promise<T>,
  errorInfo: { code: string; message: string },
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    console.error(`[${errorInfo.code}]`, error);
    return { success: false, error: errorInfo };
  }
}

export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.success) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.data;
}
