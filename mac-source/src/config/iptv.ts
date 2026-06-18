/**
 * Configuración de IPTV (Xtream Codes o Lista M3U)
 * 
 * Pega tus credenciales aquí. La aplicación leerá este archivo automáticamente.
 */

export const IPTV_CONFIG = {
    // Credenciales extraídas de la configuración de usuario (LatinChannel)
    xtreamCodes: {
        baseUrl: import.meta.env.DEV ? "/api/xtream" : "http://latinchannel.tv:8080",
        username: "sergiodutra309",
        password: "143530925",
    },

    // --- O ALTERNATIVAMENTE ---

    // Si tienes directamente la URL completa del archivo .m3u o .m3u8, pégala aquí
    directM3uUrl: "",

    // Opciones del reproductor
    autoDetectGroups: true, // Organiza automáticamente por categorías (Cine, Deportes, etc.)
};

/**
 * Función interna para construir la URL final que leerá el reproductor
 */
export const getActivePlaylistUrl = (): string | null => {
    // Intentar sacar de localStorage primero
    const stored = localStorage.getItem('iptv_config');
    let configToUse = IPTV_CONFIG;
    if (stored) {
        try {
            configToUse = JSON.parse(stored);
        } catch (e) {
            console.error("Error parsing stored config", e);
        }
    }

    // 1. Si pusiste una URL directa, la usa primero.
    if (configToUse.directM3uUrl && configToUse.directM3uUrl !== "") {
        return configToUse.directM3uUrl;
    }

    // 2. Si configuraste Xtream codes, arma la URL automáticamente (M3U Plus)
    const { baseUrl, username, password } = configToUse.xtreamCodes || {};
    if (username && username !== "TU_USUARIO_AQUI" && password && password !== "TU_PASSWORD_AQUI" && baseUrl) {
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        // Pedimos m3u8 (HLS) para que el reproductor web nativo pueda decodificarlo correctamente
        return `${cleanBase}/get.php?username=${username}&password=${password}&type=m3u_plus&output=m3u8`;
    }

    return null;
};
