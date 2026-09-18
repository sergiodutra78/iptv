import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativePlayerOptions {
    url: string;
    title?: string;
    subtitle?: string;
    /** Heading above the side list, e.g. "Capítulos" or "Canales". */
    panelTitle?: string;
    isLive?: boolean;
    hasNext?: boolean;
    hasPrev?: boolean;
    /** Labels shown in the side list, already in playback order. */
    playlist?: string[];
    /** Index of the item playing, relative to `playlist`. */
    playlistIndex?: number;
    /** Index of `playlist[0]` in the full list, so results map back. */
    playlistOffset?: number;
    startPositionMs?: number;
}

export interface NativePlayerResult {
    /** Why playback ended. */
    reason: 'close' | 'next' | 'prev' | 'ended' | 'index';
    /** Absolute index picked from the side list, or -1. */
    index: number;
    positionMs: number;
    durationMs: number;
}

interface NativePlayerPlugin {
    play(options: NativePlayerOptions): Promise<NativePlayerResult>;
}

const NativePlayer = registerPlugin<NativePlayerPlugin>('NativePlayer');

/** Intent extras have a hard size limit, so only a window of the list travels. */
const MAX_PLAYLIST_ITEMS = 400;

export const isNativePlayerAvailable = () =>
    Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('NativePlayer');

/**
 * Trim a long list down to a window centred on the item playing, keeping the
 * offset needed to translate the selected index back to the full list.
 */
export const windowPlaylist = (labels: string[], index: number) => {
    if (labels.length <= MAX_PLAYLIST_ITEMS) {
        return { playlist: labels, playlistIndex: index, playlistOffset: 0 };
    }
    const half = Math.floor(MAX_PLAYLIST_ITEMS / 2);
    const start = Math.min(Math.max(0, index - half), labels.length - MAX_PLAYLIST_ITEMS);
    return {
        playlist: labels.slice(start, start + MAX_PLAYLIST_ITEMS),
        playlistIndex: index - start,
        playlistOffset: start,
    };
};

export default NativePlayer;
