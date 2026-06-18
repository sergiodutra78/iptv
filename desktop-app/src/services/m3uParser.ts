export type ContentType = 'live' | 'movie' | 'series';

export interface Channel {
    id: string;
    name: string;
    logo: string;
    group: string;
    url: string;
    raw: string;
    type: ContentType;
    epgId?: string;
}

export interface PlaylistData {
    channels: Channel[];
    epgUrl?: string;
}

export class M3UParser {
    /**
     * Parses a standard M3U playlist string.
     * Handles 1000+ channels asynchronously.
     */
    static async parse(content: string, onProgress?: (percent: number) => void): Promise<PlaylistData> {
        const lines = content.split('\n');
        const channels: Channel[] = [];
        let currentChannel: Partial<Channel> = {};
        let epgUrl: string | undefined;

        const movieKeywords = ['movie', 'pelicula', 'cine', '4k', 'uhd', 'hd', '2024', '2023', '2025'];
        const seriesKeywords = ['series', 'temporada', 'season', 'episodio', 'episode', 's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 'capitulo', 'ep.', 't1', 't2', 't3'];

        const totalLines = lines.length;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (i === 0 && line.startsWith('#EXTM3U')) {
                const urlTvgMatch = line.match(/url-tvg="(.*?)"/) || line.match(/x-tvg-url="(.*?)"/);
                if (urlTvgMatch) epgUrl = urlTvgMatch[1];
            }

            if (line.startsWith('#EXTINF:')) {
                // Función auxiliar para extraer atributos con o sin comillas
                const getAttr = (key: string) => {
                    const regex = new RegExp(`${key}\\s*=\\s*(?:"([^"]*)"|([^\\s,]*))`, 'i');
                    const match = line.match(regex);
                    if (!match) return null;
                    return (match[1] || match[2] || '').trim();
                };

                const nameMatch = line.match(/,(.*)$/);
                const name = nameMatch ? nameMatch[1].trim() : 'Canal sin nombre';

                const tvgId = getAttr('tvg-id');
                const logo = getAttr('tvg-logo') || getAttr('logo') || getAttr('thumb') || getAttr('poster');
                const group = getAttr('group-title') || 'Otros';

                const params = {
                    id: tvgId || `ch-${i}`,
                    epgId: tvgId || undefined,
                    name,
                    logo: logo || '',
                    group,
                };
                currentChannel = { ...params };
            } else if (line.startsWith('http')) {
                currentChannel.url = line;

                // Determinamos el tipo ahora que tenemos URL y metadata
                let type: ContentType = 'live';
                const groupLower = (currentChannel.group || '').toLowerCase();
                const nameLower = (currentChannel.name || '').toLowerCase();
                const urlLower = (currentChannel.url || '').toLowerCase();

                // Prioridad 1: Marcadores de URL de Xtream Codes
                if (urlLower.includes('/series/')) {
                    type = 'series';
                } else if (urlLower.includes('/movie/')) {
                    type = 'movie';
                } else if (urlLower.includes('/live/')) {
                    type = 'live';
                }
                // Prioridad 2: Palabras clave
                else if (groupLower.includes('series') || seriesKeywords.some(k => groupLower.includes(k) || nameLower.includes(k))) {
                    // Si el grupo contiene palabras que indican streaming continuo (24/7, 24 horas, etc)
                    if (
                        groupLower.includes('24/7') ||
                        groupLower.includes('24 horas') ||
                        groupLower.includes('24hs') ||
                        groupLower.includes('24 hs') ||
                        groupLower.includes('canales tv') ||
                        groupLower.includes('argentina') ||
                        groupLower.includes('usa')
                    ) {
                        type = 'live';
                    } else {
                        type = 'series';
                    }
                } else if (
                    groupLower.includes('vod') ||
                    groupLower.includes('pelicula') ||
                    groupLower.includes('cine') ||
                    groupLower.includes('4k') ||
                    groupLower.includes('uhd') ||
                    groupLower.includes('ultimos titulos') ||
                    groupLower.includes('estrenos') ||
                    movieKeywords.some(k => groupLower.includes(k)) ||
                    (groupLower === 'otros' && !nameLower.includes('tv') && !nameLower.includes('ch'))
                ) {
                    type = 'movie';
                }

                (currentChannel as Channel).type = type;

                if (currentChannel.name) {
                    channels.push(currentChannel as Channel);
                }
                currentChannel = {};
            }

            // Yield every 100 lines to make it more gradual
            if (i % 100 === 0) {
                if (onProgress) onProgress(Math.min(99, Math.round((i / totalLines) * 100)));
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        if (onProgress) onProgress(100);
        return { channels, epgUrl };
    }

    static async fetchAndParse(url: string, onProgress?: (percent: number) => void): Promise<PlaylistData> {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error al descargar la lista M3U');
            const content = await response.text();
            return this.parse(content, onProgress);
        } catch (error) {
            console.error('M3U Parsing error:', error);
            throw error;
        }
    }
}
