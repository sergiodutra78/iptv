/**
 * Envuelve una promesa con un timeout. Si no resuelve en `ms` milisegundos,
 * rechaza con un error 'timeout'. Útil para que la Cache API (`caches`), que en
 * algunos contextos de Electron (file://) puede colgarse, nunca bloquee la UI.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);
}
