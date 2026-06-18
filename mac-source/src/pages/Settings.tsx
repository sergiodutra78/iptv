import { useState, useEffect } from 'react';
import { IPTV_CONFIG } from '../config/iptv';
import { Save, CheckCircle } from 'lucide-react';

const Settings = () => {
    const [baseUrl, setBaseUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [directUrl, setDirectUrl] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        // Cargar desde localStorage si existe
        const storedConfig = localStorage.getItem('iptv_config');
        if (storedConfig) {
            try {
                const parsed = JSON.parse(storedConfig);
                if (parsed.xtreamCodes) {
                    setBaseUrl(parsed.xtreamCodes.baseUrl || '');
                    setUsername(parsed.xtreamCodes.username || '');
                    setPassword(parsed.xtreamCodes.password || '');
                }
                if (parsed.directM3uUrl !== undefined) {
                    setDirectUrl(parsed.directM3uUrl);
                }
            } catch (e) {
                console.error("Error leyendo config", e);
            }
        } else {
            // Valores por defecto del archivo config
            setBaseUrl(IPTV_CONFIG.xtreamCodes.baseUrl);
            setUsername(IPTV_CONFIG.xtreamCodes.username === "TU_USUARIO_AQUI" ? "" : IPTV_CONFIG.xtreamCodes.username);
            setPassword(IPTV_CONFIG.xtreamCodes.password === "TU_PASSWORD_AQUI" ? "" : IPTV_CONFIG.xtreamCodes.password);
            setDirectUrl(IPTV_CONFIG.directM3uUrl);
        }
    }, []);

    const handleSave = () => {
        const newConfig = {
            xtreamCodes: {
                baseUrl,
                username,
                password
            },
            directM3uUrl: directUrl
        };

        localStorage.setItem('iptv_config', JSON.stringify(newConfig));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);

        // Recargar para aplicar cambios globally
        window.location.reload();
    };

    return (
        <div className="p-8 max-w-4xl mx-auto w-full">
            <h1 className="text-3xl font-bold mb-2">Ajustes</h1>
            <p className="text-zinc-500 mb-8">Configura tu conexión IPTV. Puedes usar Xtream Codes o una URL M3U directa.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Xtream Codes Form */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h2 className="text-xl font-bold mb-4 text-primary">Xtream Codes API</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">URL del Servidor / Host</label>
                            <input
                                type="text"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                placeholder="ej. http://servidor.tv:8080"
                                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Usuario</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Contraseña</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Direct M3U Form */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h2 className="text-xl font-bold mb-4 text-primary">URL Directa (M3U)</h2>
                    <p className="text-sm text-zinc-500 mb-4">Usa esto solo si no tienes usuario/contraseña separados de Xtream Codes.</p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Lista M3U URL</label>
                            <textarea
                                value={directUrl}
                                onChange={(e) => setDirectUrl(e.target.value)}
                                rows={4}
                                placeholder="http://servidor.tv:8080/get.php?username=XXX&password=YYY&type=m3u..."
                                className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors resize-none"
                            ></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex justify-end">
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-full font-bold hover:bg-primary/90 transition-all hover:scale-105"
                >
                    {saved ? <CheckCircle size={20} /> : <Save size={20} />}
                    {saved ? 'Guardado' : 'Guardar Ajustes'}
                </button>
            </div>
        </div>
    );
};

export default Settings;
