import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Tv, Film, PlayCircle, Heart, Settings as SettingsIcon, Play, Info } from 'lucide-react';
import LiveTV from './pages/LiveTV';
import Settings from './pages/Settings';
import Movies from './pages/Movies';
import Series from './pages/Series';
import Favorites from './pages/Favorites';
import MovieCard from './components/MovieCard';
import CachedImage from './components/CachedImage';
import { type Channel } from './services/m3uParser';
import { getActivePlaylistUrl } from './config/iptv';
import VideoPlayer from './components/VideoPlayer';
import { DataService } from './services/dataService';
import HorizontalScroll from './components/HorizontalScroll';

const Logo = ({ size = "md", animate = false }: { size?: "sm" | "md" | "lg", animate?: boolean }) => {
  const isLarge = size === "lg";
  const isSmall = size === "sm";

  return (
    <div className={`flex items-center ${isLarge ? 'flex-col gap-6' : 'gap-2'}`}>
      <div className={`relative group ${animate ? 'animate-netflix-intro' : ''}`}>
        <div className={`absolute -inset-1 bg-gradient-to-r from-primary to-red-600 rounded-lg blur opacity-25 group-hover:opacity-100 transition duration-1000`}></div>
        <div className={`relative ${isLarge ? 'w-28 h-28 text-5xl' : isSmall ? 'w-7 h-7 text-base' : 'w-9 h-9 text-lg'} bg-black border border-zinc-800 rounded-lg flex items-center justify-center font-black text-primary tracking-tighter shadow-2xl overflow-hidden`}>
          <span className={animate ? 'animate-pulse' : ''}>K</span>
          {animate && (
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent animate-scan-line"></div>
          )}
        </div>
      </div>
      <div className={`flex flex-col`}>
        <span className={`${isLarge ? 'text-5xl animate-fade-in-up' : isSmall ? 'text-base' : 'text-lg'} font-black tracking-tighter italic leading-none text-white`}>KINETIQ</span>
        <span className={`${isLarge ? 'text-xs' : 'text-[8px]'} font-bold tracking-[0.3em] text-primary uppercase leading-tight mt-0.5`} style={{ animationDelay: '200ms' }}>PREMIUM IPTV</span>
      </div>
    </div>
  );
};

const SplashLoading = ({ progress }: { progress: number }) => (
  <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-10 overflow-hidden text-center">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 blur-[150px] rounded-full animate-pulse"></div>
    <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-primary/10 blur-[100px] rounded-full"></div>

    <div className="relative flex flex-col items-center gap-14 max-w-sm w-full z-10">
      <Logo size="lg" animate={true} />

      <div className="w-full flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-black tracking-[0.3em] text-zinc-500 uppercase">
              {progress < 30 ? 'Iniciando servicios...' : progress < 70 ? 'Sincronizando biblioteca...' : progress < 100 ? 'Finalizando...' : '¡Listo!'}
            </span>
            <span className="text-xl font-black text-primary italic tracking-tighter">{progress}%</span>
          </div>
          <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden p-[1px]">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out shadow-[0_0_20px_rgba(229,9,20,0.6)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] text-white font-black italic tracking-tight uppercase">Experiencia Cinematográfica Premium</p>
          <p className="text-[9px] text-zinc-600 font-bold tracking-widest uppercase">Cargando canales, películas y series</p>
        </div>
      </div>
    </div>
  </div>
);

// Bottom navigation (mobile)
const BottomNav = () => {
  const location = useLocation();

  const menuItems = [
    { icon: <Home size={22} />, label: 'Inicio', path: '/' },
    { icon: <Tv size={22} />, label: 'TV', path: '/tv' },
    { icon: <Film size={22} />, label: 'Películas', path: '/movies' },
    { icon: <PlayCircle size={22} />, label: 'Series', path: '/series' },
    { icon: <Heart size={22} />, label: 'Favoritos', path: '/favorites' },
    { icon: <SettingsIcon size={22} />, label: 'Ajustes', path: '/settings' },
  ];

  return (
    <nav className="h-16 bg-black border-t border-zinc-900 flex items-center justify-around px-1 z-30 flex-shrink-0 safe-area-bottom">
      {menuItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${isActive ? 'text-primary' : 'text-zinc-600'}`}
          >
            <div className={`transition-transform ${isActive ? 'scale-110' : ''}`}>
              {item.icon}
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-widest ${isActive ? 'text-primary' : 'text-zinc-600'}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

// Top app bar (simplified for mobile)
const AppBar = () => {
  const location = useLocation();

  const pageTitle: Record<string, string> = {
    '/': 'Inicio',
    '/tv': 'TV en Vivo',
    '/movies': 'Películas',
    '/series': 'Series',
    '/favorites': 'Favoritos',
    '/settings': 'Ajustes',
  };

  const title = pageTitle[location.pathname] || 'KinetiQ';

  return (
    <header className="h-14 bg-black/95 border-b border-zinc-900/80 flex items-center justify-between px-4 z-30 flex-shrink-0">
      <Logo size="sm" />
      <span className="text-xs font-black tracking-widest text-zinc-500 uppercase">{title}</span>
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary via-red-800 to-black p-[2px] shadow-lg">
        <div className="w-full h-full bg-black rounded-full flex items-center justify-center">
          <span className="text-[10px] font-black text-primary">S</span>
        </div>
      </div>
    </header>
  );
};

const Inicio = () => {
  const navigate = useNavigate();
  const [heroMovie, setHeroMovie] = useState<Channel | null>(null);
  const [recentMovies, setRecentMovies] = useState<Channel[]>([]);
  const [recentSeries, setRecentSeries] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Channel | null>(null);

  useEffect(() => {
    const initContent = () => {
      if (DataService.hasData()) {
        const movies = DataService.getMoviesSync();
        const priorityCategories = ['ultimos titulos', 'ultimos titulo', 'estrenos', 'recien agregadas', 'peliculas 2024', 'peliculas 2025'];
        const priorityMovies = movies.filter(m => priorityCategories.some(cat => m.group.toLowerCase().includes(cat)));
        const otherMovies = movies.filter(m => !priorityCategories.some(cat => m.group.toLowerCase().includes(cat)));

        const allRecentMovies = [...priorityMovies, ...otherMovies.reverse()].slice(0, 50);
        setRecentMovies(allRecentMovies);

        const groupedSeriesList = DataService.getGroupedSeriesSync();
        const recentGroups = [...groupedSeriesList].reverse().slice(0, 50);
        setRecentSeries(recentGroups as any);

        if (allRecentMovies.length > 0) {
          const top10 = allRecentMovies.slice(0, 10);
          let history: string[] = [];
          try { history = JSON.parse(localStorage.getItem('kinetiq_recommendation_history') || '[]'); } catch {}

          let selectedHero = top10.find(m => !history.includes(m.id));
          if (!selectedHero) { selectedHero = top10[0]; history = []; }

          setHeroMovie(selectedHero);
          history.push(selectedHero.id);
          if (history.length > 10) history = history.slice(history.length - 10);
          localStorage.setItem('kinetiq_recommendation_history', JSON.stringify(history));
        }

        setLoading(false);
      }
    };

    const loadData = async () => {
      if (DataService.hasData()) { initContent(); return; }
      setLoading(true);
      const url = getActivePlaylistUrl() || "/uruguay.m3u";
      try {
        await DataService.getChannels(url);
        initContent();
      } catch (err) {
        console.error("Error loading home data", err);
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (selectedItem) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <VideoPlayer url={selectedItem.url} type={selectedItem.type} onClose={() => setSelectedItem(null)} />
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Hero Section */}
      <section className="relative h-[52vh] flex flex-col justify-center overflow-hidden mb-6">
        <div className="absolute inset-0 bg-black">
          {heroMovie && heroMovie.logo && (
            <>
              <div
                className="absolute inset-0 opacity-20 blur-3xl scale-125"
                style={{ backgroundImage: `url(${heroMovie.logo})`, backgroundSize: 'cover', backgroundPosition: 'center 20%' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent z-10 w-3/4"></div>

              <div className="absolute inset-0 z-10 flex justify-end items-center pr-6 pointer-events-none">
                <div className="h-[70%] aspect-[2/3] relative z-20 rounded-xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/10">
                  <CachedImage src={heroMovie.logo} alt="Featured Poster" className="w-full h-full object-cover bg-zinc-900/50" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative z-20 px-5 max-w-[65%]">
          <div className="flex items-center gap-2 text-primary font-bold text-[10px] tracking-[0.3em] uppercase mb-3">
            <Film size={12} /> Recomendación de hoy
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter mb-4 uppercase leading-none">
            {heroMovie ? heroMovie.name : "Tu próxima aventura"}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => heroMovie && setSelectedItem(heroMovie)}
              className="px-5 py-2.5 bg-primary text-white font-black rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 flex items-center gap-2 uppercase tracking-wider text-sm"
            >
              <Play size={16} fill="currentColor" /> Reproducir
            </button>
            <button className="px-5 py-2.5 bg-zinc-800/80 backdrop-blur-md text-white font-black rounded-xl flex items-center gap-2 uppercase tracking-wider text-sm">
              <Info size={16} /> Info
            </button>
          </div>
        </div>
      </section>

      {/* Películas recientes */}
      <section>
        {loading ? (
          <div className="px-5">
            <div className="w-1/3 h-6 bg-zinc-900/50 rounded-lg animate-pulse mb-4"></div>
            <div className="flex gap-3 overflow-hidden">
              {[1, 2, 3, 4].map(i => <div key={i} className="w-[120px] aspect-[2/3] bg-zinc-900/50 animate-pulse rounded-xl flex-shrink-0"></div>)}
            </div>
          </div>
        ) : (
          <HorizontalScroll title="RECIÉN AGREGADAS" onViewAll={() => navigate('/movies')}>
            {recentMovies.map(movie => (
              <div key={movie.id + movie.url} className="min-w-[130px] w-[130px] snap-start">
                <MovieCard movie={movie} onClick={(m) => setSelectedItem(m)} />
              </div>
            ))}
          </HorizontalScroll>
        )}
      </section>

      {/* Series */}
      <section className="mt-8">
        {!loading && (
          <HorizontalScroll title="SERIES TENDENCIA" onViewAll={() => navigate('/series')}>
            {recentSeries.map(item => (
              <div key={item.id + item.url} className="min-w-[130px] w-[130px] snap-start">
                <MovieCard movie={item} onClick={(m) => setSelectedItem(m)} />
              </div>
            ))}
          </HorizontalScroll>
        )}
      </section>
    </div>
  );
};

function App() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const initApp = async () => {
      const url = getActivePlaylistUrl() || "/uruguay.m3u";
      try {
        await DataService.getChannels(url, (p) => setProgress(Math.min(p, 90)));
        setProgress(95);

        setTimeout(() => {
          setProgress(100);
          setTimeout(() => setIsInitialLoading(false), 500);
        }, 1500);
      } catch (err) {
        console.error("Failed to initialize app data", err);
        setIsInitialLoading(false);
      }
    };
    initApp();
  }, []);

  if (isInitialLoading) {
    return <SplashLoading progress={progress} />;
  }

  return (
    <Router>
      <div className="flex flex-col h-screen overflow-hidden bg-black text-white selection:bg-primary/30">
        <AppBar />
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar main-content-area">
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/tv" element={<LiveTV />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/series" element={<Series />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Inicio />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </Router>
  );
}

export default App;
