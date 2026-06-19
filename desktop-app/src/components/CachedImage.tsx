import { useState, useEffect } from 'react';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
}

/**
 * Muestra una imagen remota de forma robusta.
 *
 * Nota: NO usamos la Cache API (`caches`) porque en la app empaquetada de
 * Electron (cargada vía file://) `caches.open()` se cuelga indefinidamente.
 * Chromium ya cachea las imágenes HTTP en disco automáticamente.
 *
 * El spinner se oculta tras un tiempo máximo para que un host lento o una
 * imagen que nunca responde no deje el spinner girando para siempre. La imagen
 * igual aparece (con fade-in) cuando termine de cargar de fondo.
 */
const CachedImage = ({ src, alt, className, ...props }: CachedImageProps) => {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const [showSpinner, setShowSpinner] = useState(true);

    // Limpiar la URL y manejar URLs protocol-relative (//host/img.png)
    let cleanSrc = src?.trim() || "";
    if (cleanSrc.startsWith('//')) {
        cleanSrc = 'https:' + cleanSrc;
    }

    useEffect(() => {
        setLoaded(false);
        setFailed(false);
        setShowSpinner(true);
        // El spinner desaparece a los 2.5s aunque la imagen siga cargando de fondo
        const t = setTimeout(() => setShowSpinner(false), 2500);
        return () => clearTimeout(t);
    }, [cleanSrc]);

    const imageObjectFit = className?.includes('object-cover')
        ? 'object-cover'
        : className?.includes('object-contain')
            ? 'object-contain'
            : '';

    return (
        <div className={`relative overflow-hidden bg-zinc-900/50 ${className || ''}`}>
            {showSpinner && !loaded && !failed && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60 z-10">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
            {cleanSrc && !failed && (
                <img
                    src={cleanSrc}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${imageObjectFit}`}
                    onLoad={() => { setLoaded(true); setShowSpinner(false); }}
                    onError={() => { setFailed(true); setShowSpinner(false); }}
                    {...props}
                />
            )}
        </div>
    );
};

export default CachedImage;
