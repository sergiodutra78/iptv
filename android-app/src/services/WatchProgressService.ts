const STORAGE_KEY = 'kinetiq_watch_progress';
const COMPLETED_THRESHOLD = 0.95;

interface ProgressEntry {
    position: number;
    duration: number;
    lastWatched: number;
}

export class WatchProgressService {
    private static memCache: Record<string, ProgressEntry> | null = null;

    private static getAll(): Record<string, ProgressEntry> {
        if (this.memCache) return this.memCache;
        try {
            this.memCache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return this.memCache!;
        } catch { return {}; }
    }

    static save(url: string, position: number, duration: number): void {
        if (!url || !duration || duration < 120 || isNaN(position) || isNaN(duration)) return;
        const all = this.getAll();
        if (position / duration >= COMPLETED_THRESHOLD) {
            delete all[url];
        } else {
            all[url] = { position, duration, lastWatched: Date.now() };
        }
        this.memCache = all;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        } catch {}
    }

    static get(url: string): ProgressEntry | null {
        return this.getAll()[url] ?? null;
    }

    static getProgress(url: string): number {
        const entry = this.get(url);
        if (!entry || !entry.duration) return 0;
        return Math.min(entry.position / entry.duration, 1);
    }

    static clear(url: string): void {
        const all = this.getAll();
        delete all[url];
        this.memCache = all;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        } catch {}
    }
}
