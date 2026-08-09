/**
 * Database Query Retry Utility
 * Handles transient database connection drops (e.g., Neon serverless PostgreSQL cold-starts / reconnects)
 */

export async function withDbRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelayMs = 400): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const errorMessage = error?.message || String(error);
      const isTransientDbError =
        errorMessage.includes("Can't reach database server") ||
        errorMessage.includes("terminating connection due to administrator command") ||
        errorMessage.includes("Connection terminated unexpectedly") ||
        errorMessage.includes("ServerHasNoCommands") ||
        error?.code === 'P1001' || // Prisma: Cannot reach database
        error?.code === 'P1002' || // Prisma: Database server timeout
        error?.code === 'P1017';   // Prisma: Server has closed connection

      if (isTransientDbError && attempt < maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[DbRetry] Transient DB connection drop detected (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms… Error: ${errorMessage}`);
        await new Promise((res) => setTimeout(res, delay));
      } else {
        throw error;
      }
    }
  }
}
