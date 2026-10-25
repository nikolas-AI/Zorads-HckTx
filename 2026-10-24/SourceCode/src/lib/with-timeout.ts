/** Bound waits even when an SDK stalls before issuing its network request. */
export async function withTimeout<T>(operation: PromiseLike<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("The request timed out. Please retry.")), milliseconds);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
