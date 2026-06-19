import { useState, useEffect } from 'react';
import { withTimeout } from '../utils/withTimeout';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
}

const CACHE_NAME = 'kinetiq-images';

// Caché de sesión: sobrevive entre navegaciones (no se borra al desmontar componentes).
// Guarda url → objectUrl (blob) o la url directa como fallback.
// Esto evita volver a la Cache API al cambiar de sección y volver — las imágenes
// ya cargadas aparecen al instante sin ninguna operación async.
const SESSION_CACHE = new Map<string, string>();

const CachedImage = ({ src, alt, className, ...props }: CachedImageProps) => {
    let cleanSrc = src?.trim() || "";
    if (cleanSrc.startsWith('//')) cleanSrc = 'https:' + cleanSrc;

    const [displaySrc, setDisplaySrc] = useState<string>(() => SESSION_CACHE.get(cleanSrc) || "");
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const [showSpinner, setShowSpinner] = useState(!SESSION_CACHE.has(cleanSrc));

    useEffect(() => {
        // Hit de sesión: ya está en memoria, mostrar de inmediato sin async
        const sessionHit = SESSION_CACHE.get(cleanSrc);
        if (sessionHit) {
            setDisplaySrc(sessionHit);
            setShowSpinner(false);
            return;
        }

        let mounted = true;
        setLoaded(false);
        setFailed(false);
        setShowSpinner(true);
        setDisplaySrc("");

        const spinnerTimer = setTimeout(() => { if (mounted) setShowSpinner(false); }, 2500);

        const run = async () => {
            if (!cleanSrc) {
                if (mounted) setFailed(true);
                return;
            }

            try {
                if ('caches' in window) {
                    const cache = await withTimeout(caches.open(CACHE_NAME), 1500);

                    const hit = await withTimeout(cache.match(cleanSrc), 1500);
                    if (hit) {
                        const blob = await hit.blob();
                        const objectUrl = URL.createObjectURL(blob);
                        SESSION_CACHE.set(cleanSrc, objectUrl);
                        if (mounted) setDisplaySrc(objectUrl);
                        return;
                    }

                    const res = await withTimeout(fetch(cleanSrc), 8000);
                    if (res.ok) {
                        cache.put(cleanSrc, res.clone()).catch(() => {});
                        const blob = await res.blob();
                        const objectUrl = URL.createObjectURL(blob);
                        SESSION_CACHE.set(cleanSrc, objectUrl);
                        if (mounted) setDisplaySrc(objectUrl);
                        return;
                    }
                }
            } catch (e) {
                // Cache API falló/timeout -> caer a URL directa
            }

            SESSION_CACHE.set(cleanSrc, cleanSrc);
            if (mounted) setDisplaySrc(cleanSrc);
        };

        run();

        return () => {
            mounted = false;
            clearTimeout(spinnerTimer);
            // No revocar: los objectUrls en SESSION_CACHE son referencias de sesión
        };
    }, [cleanSrc]);

    return (
        <div className="relative w-full h-full overflow-hidden bg-zinc-900/50 flex items-center justify-center">
            {showSpinner && !loaded && !failed && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60 z-10">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
            {displaySrc && !failed && (
                <img
                    src={displaySrc}
                    alt={alt}
                    decoding="async"
                    className={`max-w-full max-h-full transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${className || ''}`}
                    onLoad={() => { setLoaded(true); setShowSpinner(false); }}
                    onError={() => { setFailed(true); setShowSpinner(false); }}
                    {...props}
                />
            )}
        </div>
    );
};

export default CachedImage;
