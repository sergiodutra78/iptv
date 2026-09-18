const WATCHED_KEY = 'iptv_watched_episodes';

export class WatchedService {
    private static watchedSet: Set<string> = new Set(JSON.parse(localStorage.getItem(WATCHED_KEY) || '[]'));

    static isWatched(episodeId: string): boolean {
        return this.watchedSet.has(episodeId);
    }

    static markAsWatched(episodeId: string): void {
        this.watchedSet.add(episodeId);
        this.save();
    }

    static unmarkAsWatched(episodeId: string): void {
        this.watchedSet.delete(episodeId);
        this.save();
    }

    private static save(): void {
        localStorage.setItem(WATCHED_KEY, JSON.stringify(Array.from(this.watchedSet)));
    }
}
