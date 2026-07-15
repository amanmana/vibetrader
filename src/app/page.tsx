'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Search, 
  ShieldAlert, 
  Compass, 
  Activity, 
  Target, 
  Layers, 
  BarChart3, 
  ArrowRight,
  TrendingDown,
  Info,
  BadgeAlert,
  BadgeCheck,
  Zap,
  Lock,
  LogOut,
  Star,
  RefreshCw,
  Trash2,
  Newspaper,
  Radar,
  Trophy,
  ClipboardPaste,
  X,
  AlertCircle,
  RefreshCcw,
  Save,
  Calculator,
  Loader2,
  Check
} from 'lucide-react';
import { getStaticGannTargets } from '@/utils/gann';

export default function VibeTrader() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [ticker, setTicker] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistResults, setWatchlistResults] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [newsResult, setNewsResult] = useState<any>(null);
  const [loadingNews, setLoadingNews] = useState(false);
  
  // Screener State
  const [activeTab, setActiveTab] = useState<'watchlist' | 'screener' | 'us-sniper' | 'calculator'>('watchlist');

  // Calculator state
  const [calcTicker, setCalcTicker] = useState('');
  const [calcPrice, setCalcPrice] = useState<string>('');
  const [calcCompany, setCalcCompany] = useState('');
  const [calcLastFetch, setCalcLastFetch] = useState<string>('');
  const [calcRecent, setCalcRecent] = useState<string[]>([]);
  const [isCalcFetching, setIsCalcFetching] = useState(false);
  const [calcError, setCalcError] = useState('');
  const [usSniperResults, setUsSniperResults] = useState<any[]>([]);
  const [isFetchingUsSniper, setIsFetchingUsSniper] = useState(false);
  const [usSniperType, setUsSniperType] = useState('top_swing_picks');
  const [usSniperView, setUsSniperView] = useState<'scanner' | 'watchlist'>('scanner');
  const [usWatchlist, setUsWatchlist] = useState<any[]>([]);
  const [isFetchingUsWatchlist, setIsFetchingUsWatchlist] = useState(false);
  const [isSavingUsWatchlist, setIsSavingUsWatchlist] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [showDynamic, setShowDynamic] = useState(false);
  const [screenerResults, setScreenerResults] = useState<any[]>([]);
  const [isScreening, setIsScreening] = useState(false);
  const [screenerType, setScreenerType] = useState('day_gainers');
  
  // Top Picks State
  const [topPicks, setTopPicks] = useState<any[]>([]);
  const [ignoredPicks, setIgnoredPicks] = useState<string[]>([]);

  // Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');

  // Gann Scale State (Default false = Swing x1, True = Intraday x100)
  const [isGannIntraday, setIsGannIntraday] = useState(false);
  const [showDynamicLevels, setShowDynamicLevels] = useState(false);
  const [isRefreshingTable, setIsRefreshingTable] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = localStorage.getItem('vibe_authorized');
      if (auth === 'true') {
        setIsLoggedIn(true);
      }
      const saved = localStorage.getItem('vibe_latest_counters');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLatestCounters(parsed);
          }
        } catch (e) {
          console.error('Failed to parse latest counters:', e);
        }
      }
      const fetchWatchlist = async () => {
        try {
          const res = await fetch('/api/us-watchlist-portfolio', { cache: 'no-store' });
          const data = await res.json();
          if (data.success) {
            if (data.tickers && data.tickers.length === 0 && localStorage.getItem('vibe_watchlist')) {
              // Migrate local to DB if DB is empty but local has data
              const savedWatchlist = localStorage.getItem('vibe_watchlist');
              if (savedWatchlist) {
                const parsed = JSON.parse(savedWatchlist);
                setWatchlist(parsed);
                fetch('/api/us-watchlist-portfolio', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tickers: parsed, results: [] })
                }).catch(console.error);
              }
            } else {
              const sortedResults = (data.results || []).sort((a: any, b: any) => {
                const scoreA = parseFloat(a.adaptive_sniper?.score || a.score || 0);
                const scoreB = parseFloat(b.adaptive_sniper?.score || b.score || 0);
                return scoreB - scoreA;
              });
              setWatchlist(data.tickers || []);
              setWatchlistResults(sortedResults);
            }
          } else {
            const savedWatchlist = localStorage.getItem('vibe_watchlist');
            if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));
          }
        } catch (e) {
          console.error('Failed to fetch watchlist from DB', e);
          const savedWatchlist = localStorage.getItem('vibe_watchlist');
          if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));
        }
        setIsCheckingAuth(false);
      };
      fetchWatchlist();
    }
  }, []);

  const syncWatchlistToDB = async (tickers: string[], results: any[]) => {
    try {
      await fetch('/api/us-watchlist-portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers, results })
      });
    } catch (e) {
      console.error("Failed to sync watchlist to DB:", e);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'durian6447') {
      setIsLoggedIn(true);
      setLoginError('');
      localStorage.setItem('vibe_authorized', 'true');
    } else {
      setLoginError('Incorrect Magic keyword. Please try again.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('vibe_authorized');
  };

  const toggleWatchlist = (symbol: string) => {
    if (!symbol) return;
    const isAdding = !watchlist.includes(symbol);
    const updatedWatchlist = isAdding ? [...watchlist, symbol] : watchlist.filter(t => t !== symbol);
    
    setWatchlist(updatedWatchlist);
    localStorage.setItem('vibe_watchlist', JSON.stringify(updatedWatchlist));
    
    const updatedResults = isAdding ? watchlistResults : watchlistResults.filter(r => r.ticker !== symbol);
    if (!isAdding) setWatchlistResults(updatedResults);

    syncWatchlistToDB(updatedWatchlist, updatedResults);
  };

  const scanWatchlist = async () => {
    if (watchlist.length === 0) return;
    setIsScanning(true);
    setWatchlistResults([]); // Clear previous
    const results = [];
    for (const sym of watchlist) {
      try {
        const response = await fetch('/api/gann-edge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: sym }),
        });
        const data = await response.json();
        if (!data.error) {
          results.push(data);
        }
      } catch (err) {
        console.error(`Failed to analyze ${sym}:`, err);
      }
    }
    results.sort((a: any, b: any) => {
      const scoreA = parseFloat(a.adaptive_sniper?.score || a.score || 0);
      const scoreB = parseFloat(b.adaptive_sniper?.score || b.score || 0);
      return scoreB - scoreA;
    });
    setWatchlistResults(results);
    syncWatchlistToDB(watchlist, results);
    setIsScanning(false);
  };

  const handleRefreshWatchlist = async () => {
    setIsRefreshingTable(true);
    try {
      const res = await fetch('/api/us-watchlist-portfolio', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        const sortedResults = (data.results || []).sort((a: any, b: any) => {
          const scoreA = parseFloat(a.adaptive_sniper?.score || a.score || 0);
          const scoreB = parseFloat(b.adaptive_sniper?.score || b.score || 0);
          return scoreB - scoreA;
        });
        setWatchlist(data.tickers || []);
        setWatchlistResults(sortedResults);
      }
    } catch (e) {
      console.error('Failed to refresh table', e);
    }
    setIsRefreshingTable(false);
  };

  const findTopPicks = (ignoredList: string[] = ignoredPicks) => {
    const currentResults = activeTab === 'watchlist' ? watchlistResults : screenerResults;
    if (!currentResults || currentResults.length === 0) return;
    
    // Filter for BUY or HOLD >= 9.0 and NOT in ignoredPicks
    const filtered = currentResults.filter(res => {
      if (ignoredList.includes(res.ticker)) return false;

      const action = res.trading_decision?.action || res.action;
      const score = res.adaptive_sniper?.score || res.score;
      if (action === 'BUY') return true;
      if (action === 'HOLD' && parseFloat(score) >= 9.0) return true;
      return false;
    });

    // Sort descending by score
    const sorted = filtered.sort((a, b) => {
      const scoreA = parseFloat(a.adaptive_sniper?.score || a.score);
      const scoreB = parseFloat(b.adaptive_sniper?.score || b.score);
      return scoreB - scoreA;
    });

    // Get top 3
    setTopPicks(sorted.slice(0, 3));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchUsSniper = async () => {
    setIsFetchingUsSniper(true);
    setLiveError('');
    try {
      const res = await fetch(`/api/screener?type=${usSniperType}`);
      const data = await res.json();
      if (data.results) {
        setUsSniperResults(data.results);
      } else {
        setLiveError(data.error || 'Failed to fetch US Market data.');
      }
    } catch (e: any) {
      console.error("Failed to fetch US Sniper:", e);
      setLiveError(e.message || 'Failed to fetch US Market data.');
    } finally {
      setIsFetchingUsSniper(false);
    }
  };

  const removeUsSniperResult = (ticker: string) => {
    setUsSniperResults(prev => prev.filter(r => r.ticker !== ticker));
  };

  const fetchUsWatchlist = async () => {
    setIsFetchingUsWatchlist(true);
    try {
      const res = await fetch(`/api/us-custom-picks`);
      const data = await res.json();
      if (data.success) {
        setUsWatchlist(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch US Watchlist:", e);
    } finally {
      setIsFetchingUsWatchlist(false);
    }
  };

  const saveToUsWatchlist = async (row: any) => {
    setIsSavingUsWatchlist(true);
    try {
      const payload = {
        ticker: row.ticker,
        name: row.name,
        price: row.price,
        score: row.score,
        highestPrice: row.highestPrice,
        staticSL: row.staticSL,
        staticSLColor: row.staticSLColor,
        staticTP1: row.staticTP1,
        staticTP1Color: row.staticTP1Color,
        staticTP2: row.staticTP2,
        staticTP2Color: row.staticTP2Color,
        staticTP3: row.staticTP3,
        staticTP3Color: row.staticTP3Color,
      };
      const res = await fetch('/api/us-custom-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) {
        console.error('Failed to save:', data.error);
        return;
      }
      setUsWatchlist(prev => [...prev, payload]);
    } catch (e) {
      console.error("Failed to save to US Watchlist:", e);
    } finally {
      setIsSavingUsWatchlist(false);
    }
  };

  const removeFromUsWatchlist = async (ticker: string) => {
    try {
      await fetch(`/api/us-custom-picks?ticker=${ticker}`, { method: 'DELETE' });
      setUsWatchlist(prev => prev.filter(r => r.ticker !== ticker));
    } catch (e) {
      console.error("Failed to remove from US Watchlist:", e);
    }
  };

  useEffect(() => {
    if (activeTab === 'us-sniper' && usSniperView === 'scanner' && usSniperResults.length === 0) {
      fetchUsSniper();
    }
    if (activeTab === 'us-sniper' && usSniperView === 'watchlist' && usWatchlist.length === 0) {
      fetchUsWatchlist();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, usSniperType, usSniperView]);

  const fetchCalcPrice = async () => {
    if (!calcTicker) return;
    setIsCalcFetching(true);
    setCalcError('');
    try {
      const response = await fetch('/api/gann-edge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: calcTicker.toUpperCase() })
      });
      const data = await response.json();
      
      if (data && !data.error) {
        const p = data.technical_indicators?.current_price || data.levels?.entry_price;
        if (p) {
          setCalcPrice(p.toString());
          if (data.company_name) setCalcCompany(data.company_name);
          
          setCalcLastFetch(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          
          // Add to recent
          const tick = calcTicker.toUpperCase();
          setCalcRecent(prev => {
            const newRecent = [tick, ...prev.filter(t => t !== tick)].slice(0, 5);
            return newRecent;
          });
        } else {
          setCalcError('Ticker not found or no price data available.');
        }
      } else {
        setCalcError(data.error || 'Ticker not found.');
      }
    } catch (e) {
      console.error(e);
      setCalcError('Failed to fetch ticker data.');
    } finally {
      setIsCalcFetching(false);
    }
  };

  const scanMarket = async () => {
    setIsScreening(true);
    setLiveError('');
    setScreenerResults([]);
    try {
      const res = await fetch(`/api/screener?type=${screenerType}`);
      const data = await res.json();
      if (data.success && data.results) {
        setScreenerResults(data.results);
      } else {
        setLiveError(data.error || 'Failed to scan market.');
      }
    } catch (e: any) {
      console.error("Failed to fetch Live Screener:", e);
      setLiveError(e.message || 'Failed to scan market.');
    } finally {
      setIsScreening(false);
    }
  };

  const handleLiveScan = async () => {
    setIsScreening(true);
    setScreenerResults([]);
    try {
      const res = await fetch(`/api/screener?type=${screenerType}`);
      const data = await res.json();
      if (data.results) {
        setScreenerResults(data.results);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsScreening(false);
    }
  };

  const handleImport = () => {
    if (!importText) return;
    
    let extracted: string[] = [];
    
    // Convert all whitespace (newlines, tabs, spaces) into a flat array of words
    const tokens = importText.trim().split(/\s+/);
    
    // Look for Finviz pattern: Number followed immediately by a Ticker
    const numRegex = new RegExp('^\\d+$');
    const tickerRegex = new RegExp('^[A-Z]{1,5}$');
    
    for (let i = 0; i < tokens.length - 1; i++) {
      if (numRegex.test(tokens[i]) && tickerRegex.test(tokens[i+1])) {
        extracted.push(tokens[i+1]);
      }
    }
    
    // Fallback: If no Finviz table pattern found, just extract all valid words
    if (extracted.length === 0) {
      const ignoreList = ['ETF', 'USA', 'REIT', 'NYSE', 'AMEX', 'CSV', 'TA', 'P', 'E', 'S', 'U', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'AM', 'PM', 'ET', 'ADR', 'VIX', 'NO', 'TICKER', 'VOL', 'CHG'];
      const extractRegex = new RegExp('\\b[A-Z]{1,5}\\b', 'g');
      const matches = importText.match(extractRegex) || [];
      extracted = matches.filter(m => !ignoreList.includes(m));
    }
    
    if (extracted.length > 0) {
      const newWatchlist = Array.from(new Set([...watchlist, ...extracted])).slice(0, 50);
      setWatchlist(newWatchlist);
      localStorage.setItem('vibe_watchlist', JSON.stringify(newWatchlist));
      syncWatchlistToDB(newWatchlist, watchlistResults);
      setShowImportModal(false);
      setImportText('');
    } else {
      alert("No valid tickers found. Please paste a Finviz table or a list of tickers.");
    }
  };

  const [latestCounters, setLatestCounters] = useState<string[]>(['MOD', 'NVDA', 'AAPL', 'TSLA', 'MYEG']);

  const getCurrencySymbol = (sym: string) => {
    if (!sym) return '$';
    const s = sym.trim().toUpperCase();
    if (s === 'MYEG' || s.endsWith('.KL') || s.endsWith('.MY') || /^\d{4}$/.test(s)) {
      return 'RM';
    }
    return '$';
  };

  const cSym = result ? getCurrencySymbol(result.ticker) : '$';

  const calculatePricePercent = () => {
    if (!result || !result.levels) return 0;
    const currentPrice = result.technical_indicators?.current_price || 0;
    const sl = result.levels.stop_loss || 0;
    const tp3 = result.levels.take_profit_3 || 0;
    
    if (tp3 === sl) return 0;
    const percent = ((currentPrice - sl) / (tp3 - sl)) * 100;
    return Math.min(Math.max(percent, 0), 100);
  };

  const lastPricePercent = calculatePricePercent();

  const analyzeTicker = async (tickerToAnalyze: string) => {
    const symbol = tickerToAnalyze.trim().toUpperCase();
    if (!symbol) {
      setError('Please enter a valid stock code.');
      return;
    }
    
    setError('');
    setLoading(true);
    setNewsResult(null);
    setLoadingNews(true);

    // Fetch news concurrently
    fetch('/api/news-sentiment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: symbol }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setNewsResult({ error: data.error });
        } else {
          setNewsResult(data);
        }
      })
      .catch(err => console.error('Failed to fetch news:', err))
      .finally(() => setLoadingNews(false));

    try {
      const response = await fetch('/api/gann-edge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: symbol }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response from the server.');
      }
      
      const data = await response.json();
      if (data.error) {
        setError(data.error);
        setResult(null);
      } else {
        setResult(data);
        setLatestCounters((prev) => {
          const updated = [symbol, ...prev.filter((c) => c !== symbol)].slice(0, 7);
          localStorage.setItem('vibe_latest_counters', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err: any) {
      console.error('Failed to analyze:', err);
      setError('Connection error. Please try again later.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const getActionStyles = (action: string, trend?: string, confidence?: string) => {
    if (action === 'BUY') {
      if (trend === 'Bullish' && confidence === 'High') {
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          badge: 'bg-emerald-500 text-zinc-950 shadow-emerald-500/20',
          text: 'text-emerald-400',
          glow: 'shadow-emerald-500/10'
        };
      } else {
        // Yellow warning state for drawdown or medium confidence active trades
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          badge: 'bg-amber-500 text-zinc-950 shadow-amber-500/20',
          text: 'text-amber-400',
          glow: 'shadow-amber-500/10'
        };
      }
    }

    switch (action) {
      case 'HOLD':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          badge: 'bg-amber-500 text-zinc-950 shadow-amber-500/20',
          text: 'text-amber-400',
          glow: 'shadow-amber-500/10'
        };
      case 'WATCH':
        return {
          bg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
          badge: 'bg-indigo-500 text-white shadow-indigo-500/20',
          text: 'text-indigo-400',
          glow: 'shadow-indigo-500/10'
        };
      default:
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          badge: 'bg-rose-500 text-white shadow-rose-500/20',
          text: 'text-rose-400',
          glow: 'shadow-rose-500/10'
        };
    }
  };

  // Helper for computing risk/reward ratio
  const calculateRRRatio = (entry: number, sl: number, tp: number) => {
    const risk = entry - sl;
    const reward = tp - entry;
    if (risk <= 0) return 'N/A';
    return (reward / risk).toFixed(1);
  };

  if (isCheckingAuth) {
    return (
      <main className="relative min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 border-3 border-zinc-800 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm font-mono">Loading security settings...</p>
        </div>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="relative min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-sans px-6 overflow-hidden">
        {/* Background glow decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-[400px] bg-blue-900/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative w-full max-w-md bg-zinc-900/40 border border-zinc-800/80 p-8 rounded-3xl backdrop-blur-xl shadow-2xl space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl mb-2">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
              Adaptive Sniper AI
            </h1>
            <p className="text-zinc-400 text-xs md:text-sm">
              Please enter the Magic Keyword to access the swing trading analysis engine.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-zinc-500 text-xs font-bold uppercase tracking-wider">
                Magic Keyword
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter keyword..."
                className="w-full bg-zinc-950/80 border border-zinc-850 focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 p-4 rounded-xl outline-none text-zinc-100 placeholder-zinc-700 transition text-center font-mono tracking-widest text-base"
                autoFocus
              />
            </div>

            {loginError && (
              <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 px-4 py-3 rounded-xl">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-900/10"
            >
              <Zap className="w-4 h-4 fill-current" />
              MAIN ACCESS
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden font-sans pb-20">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-gradient-to-b from-blue-900/10 via-indigo-900/5 to-transparent rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative max-w-5xl mx-auto px-6 pt-16">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-12 relative">
          <button
            onClick={handleLogout}
            className="absolute right-0 top-0 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 hover:border-zinc-700 p-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 transition cursor-pointer flex items-center gap-2 text-xs font-semibold"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Log Out</span>
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium mb-4 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Adaptive Sniper Engine v2.0.0 Online
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent mb-3">
            Adaptive Sniper AI
          </h1>
          <p className="text-zinc-400 max-w-lg text-sm md:text-base leading-relaxed">
            Adaptive algorithmic trading engine executing pullback swing strategies and momentum breakouts.
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 p-6 md:p-8 rounded-3xl backdrop-blur-xl shadow-2xl mb-8">
          <div className="max-w-xl mx-auto">
            <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Search & Analyze Ticker
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
                <input 
                  type="text"
                  value={ticker}
                  className="w-full bg-zinc-950/80 border border-zinc-800 focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 p-4 pl-12 rounded-2xl outline-none text-zinc-100 placeholder-zinc-600 transition font-mono uppercase tracking-wider text-base"
                  placeholder="Example: MOD, NVDA, MYEG..."
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && analyzeTicker(ticker)}
                />
              </div>
              <button 
                onClick={() => analyzeTicker(ticker)}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white px-8 py-4 rounded-2xl font-bold transition flex items-center justify-center gap-2 text-base cursor-pointer shadow-lg shadow-blue-900/20"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    ANALYZE
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 px-4 py-3 rounded-xl">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick selectors */}
            <div className="flex flex-wrap items-center gap-2 mt-5">
              <span className="text-zinc-600 text-xs font-medium mr-1">Latest Counter:</span>
              {latestCounters.map((popTicker) => (
                <button
                  key={popTicker}
                  onClick={() => {
                    setTicker(popTicker);
                    analyzeTicker(popTicker);
                  }}
                  className="bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-850 hover:border-zinc-700 px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-400 transition cursor-pointer"
                >
                  {popTicker}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced Modules Wrapper */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl backdrop-blur-xl shadow-2xl mb-8 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800/60 bg-zinc-900/50">
            <button
              onClick={() => {
                setActiveTab('watchlist');
                setTopPicks([]);
                setIgnoredPicks([]);
              }}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 ${
                activeTab === 'watchlist' ? 'border-amber-400 text-amber-400 bg-zinc-800/30' : 'border-transparent text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
              }`}
            >
              <Star className={`w-4 h-4 ${activeTab === 'watchlist' ? 'fill-amber-400/20' : ''}`} />
              Watchlist Portfolio
            </button>
            <button
              onClick={() => {
                setActiveTab('screener');
                setTopPicks([]);
                setIgnoredPicks([]);
                if (screenerResults.length === 0) scanMarket();
              }}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 ${
                activeTab === 'screener' ? 'border-blue-400 text-blue-400 bg-zinc-800/30' : 'border-transparent text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
              }`}
            >
              <Radar className="w-4 h-4" />
              Live Screener
            </button>
            <button
              onClick={() => {
                setActiveTab('us-sniper');
                setTopPicks([]);
                setIgnoredPicks([]);
                if (usSniperResults.length === 0 && usSniperView === 'scanner') fetchUsSniper();
                if (usWatchlist.length === 0 && usSniperView === 'watchlist') fetchUsWatchlist();
              }}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 ${
                activeTab === 'us-sniper' ? 'border-rose-400 text-rose-400 bg-zinc-800/30' : 'border-transparent text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
              }`}
            >
              🇺🇸 US Sniper
            </button>
            <button
              onClick={() => {
                setActiveTab('calculator');
                setTopPicks([]);
                setIgnoredPicks([]);
              }}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition border-b-2 ${
                activeTab === 'calculator' ? 'border-emerald-400 text-emerald-400 bg-zinc-800/30' : 'border-transparent text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
              }`}
            >
              <Calculator className="w-4 h-4" />
              Calculator
            </button>
          </div>

          <div className="p-6 md:p-8">
            {topPicks.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-amber-500/20">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-amber-400">Top 3 Sniper Picks 🎯</h3>
                    <p className="text-sm text-amber-500/70">The absolute best setups from your current scan.</p>
                  </div>
                  <button 
                    onClick={() => setTopPicks([])}
                    className="ml-auto p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-xl transition"
                    title="Close Top Picks"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {topPicks.map((res, i) => {
                    const action = res.trading_decision?.action || res.action;
                    const score = res.adaptive_sniper?.score || res.score;
                    const isBuy = action === 'BUY';
                    const price = res.technical_indicators?.current_price || res.price || 0;
                    const name = res.name || '';
                    
                    return (
                      <div key={i} className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-br from-amber-500/40 to-orange-600/10 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
                        <div className="relative p-6 rounded-2xl border border-amber-500/30 bg-zinc-950/80 backdrop-blur-sm flex flex-col gap-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=${res.ticker}`} target="_blank" rel="noopener noreferrer" className="font-mono font-bold text-2xl text-zinc-100 hover:text-blue-400 transition cursor-pointer">{res.ticker}</a>
                                {i === 0 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-zinc-950">#1</span>}
                                {i === 1 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-300 text-zinc-950">#2</span>}
                                {i === 2 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-700 text-zinc-100">#3</span>}
                              </div>
                              <span className="block text-sm text-zinc-400 mt-1">{getCurrencySymbol(res.ticker)} {price ? price.toFixed(2) : '-'}</span>
                              {name && <span className="block text-xs text-zinc-600 line-clamp-1 mt-1">{name}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newIgnored = [...ignoredPicks, res.ticker];
                                  setIgnoredPicks(newIgnored);
                                  findTopPicks(newIgnored);
                                }}
                                className="p-1.5 rounded-lg text-amber-500/50 hover:text-rose-400 hover:bg-rose-500/20 transition"
                                title="Ignore this pick"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${isBuy ? 'bg-emerald-500 text-zinc-950' : 'bg-amber-500 text-zinc-950'}`}>
                                {action}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-end mt-4 pt-4 border-t border-zinc-800">
                            <div>
                              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">Sniper Score</span>
                              <div className="flex items-baseline gap-1">
                                <span className={`text-3xl font-black ${isBuy ? 'text-emerald-400' : 'text-amber-400'}`}>{score}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setTicker(res.ticker);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition shadow-lg shadow-blue-500/20"
                              title="Deep Analysis"
                            >
                              <ArrowRight className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'watchlist' && (
              <>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div>
                    <h3 className="text-zinc-200 font-bold text-lg flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                      Watchlist Portfolio
                    </h3>
                    <p className="text-zinc-500 text-xs mt-1">Tracked tickers for daily scanning</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {watchlist.length > 0 && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to clear all tickers?')) {
                            setWatchlist([]);
                            setWatchlistResults([]);
                            localStorage.setItem('vibe_watchlist', JSON.stringify([]));
                            syncWatchlistToDB([], []);
                          }
                        }}
                        className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2"
                        title="Clear Watchlist"
                      >
                        <Trash2 className="w-4 h-4" />
                        Clear All
                      </button>
                    )}
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 px-3 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2"
                      title="Paste from Finviz"
                    >
                      <ClipboardPaste className="w-4 h-4" />
                      Paste Tickers
                    </button>
                    <button
                      onClick={scanWatchlist}
                      disabled={isScanning}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Scan All"
                    >
                      <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                      {isScanning ? 'Scanning...' : 'Scan All'}
                    </button>
                    {watchlistResults.length > 0 && (
                      <button
                        onClick={() => findTopPicks()}
                        className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2"
                        title="Find Top 3 Sniper Picks"
                      >
                        <Trophy className="w-4 h-4" />
                        Top 3 Picks
                      </button>
                    )}
                  </div>
                </div>

                {/* Watchlist Tags */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {watchlist.map((sym) => (
                    <div key={sym} className="group relative flex items-center bg-zinc-950/80 border border-zinc-800 rounded-lg overflow-hidden">
                      <button
                        onClick={() => {
                          setTicker(sym);
                          analyzeTicker(sym);
                        }}
                        className="px-3 py-2 text-sm font-mono font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                      >
                        {sym}
                      </button>
                      <button
                        onClick={() => toggleWatchlist(sym)}
                        className="px-2 py-2 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition border-l border-zinc-800"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Watchlist Scan Results Grid */}
                {watchlistResults.length > 0 && (
                  <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex justify-start items-center gap-3 mb-4">
                      <button
                        onClick={() => setShowDynamicLevels(!showDynamicLevels)}
                        className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-lg backdrop-blur-sm"
                        title={showDynamicLevels ? "Show Static Gann" : "Show Dynamic TP/SL"}
                      >
                        {showDynamicLevels ? 'Show Static Gann' : 'Show Dynamic TP/SL'}
                      </button>
                      <button
                        onClick={handleRefreshWatchlist}
                        disabled={isRefreshingTable}
                        className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg backdrop-blur-sm"
                        title="Refresh Table"
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshingTable ? 'animate-spin' : ''}`} />
                        {isRefreshingTable ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>
                    <div className="border border-zinc-800 bg-zinc-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-900/80 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                            <th className="p-4 font-semibold pl-6 w-16">Rank</th>
                            <th className="p-4 font-semibold">Stock</th>
                            <th className="p-4 font-semibold">Score</th>
                            <th className="p-4 font-semibold">Last Price</th>
                            <th className="p-4 font-semibold text-rose-400/80">Stop Loss</th>
                            <th className="p-4 font-semibold text-emerald-400/80">TP1</th>
                            <th className="p-4 font-semibold text-emerald-400/80">TP2</th>
                            <th className="p-4 font-semibold pr-6 text-right">Act</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {watchlistResults.map((res, i) => {
                            const isBuy = res.trading_decision?.action === 'BUY';
                            return (
                              <tr key={i} className="hover:bg-zinc-800/30 transition group">
                                <td className="p-4 pl-6">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${isBuy ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                    #{i + 1}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=${res.ticker}`} target="_blank" rel="noopener noreferrer" className="font-bold text-zinc-200 hover:text-amber-400 hover:underline transition cursor-pointer">{res.ticker}</a>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className={`font-bold ${
                                    parseFloat(res.adaptive_sniper?.score || '0') >= 7.0 ? 'text-emerald-400' :
                                    parseFloat(res.adaptive_sniper?.score || '0') >= 5.0 ? 'text-amber-400' : 'text-rose-400'
                                  }`}>{res.adaptive_sniper?.score || '-'}</span>
                                </td>
                                <td className="p-4 font-mono text-sm text-zinc-300">
                                  {res.technical_indicators?.current_price ? `${getCurrencySymbol(res.ticker)} ${res.technical_indicators.current_price.toFixed(2)}` : '-'}
                                </td>
                                <td className="p-4 font-mono text-sm font-bold text-rose-400">
                                  {res.levels?.stop_loss ? `${getCurrencySymbol(res.ticker)} ${(showDynamicLevels || !res.levels.static_sl) ? res.levels.stop_loss.toFixed(2) : res.levels.static_sl.toFixed(2)}` : '-'}
                                </td>
                                <td className="p-4 font-mono text-sm font-medium">
                                  {res.levels?.take_profit_1 ? (
                                    <span className={`${(res.technical_indicators?.current_price || 0) >= ((showDynamicLevels || !res.levels.static_tp1) ? res.levels.take_profit_1 : res.levels.static_tp1) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>
                                      {getCurrencySymbol(res.ticker)} {(showDynamicLevels || !res.levels.static_tp1) ? res.levels.take_profit_1.toFixed(2) : res.levels.static_tp1.toFixed(2)}
                                    </span>
                                  ) : '-'}
                                </td>
                                <td className="p-4 font-mono text-sm font-medium">
                                  {res.levels?.take_profit_2 ? (
                                    <span className={`${(res.technical_indicators?.current_price || 0) >= ((showDynamicLevels || !res.levels.static_tp2) ? res.levels.take_profit_2 : res.levels.static_tp2) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>
                                      {getCurrencySymbol(res.ticker)} {(showDynamicLevels || !res.levels.static_tp2) ? res.levels.take_profit_2.toFixed(2) : res.levels.static_tp2.toFixed(2)}
                                    </span>
                                  ) : '-'}
                                </td>
                                <td className="p-4 pr-6">
                                  <div className="flex items-center justify-end gap-3">
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isBuy ? 'bg-emerald-500 text-zinc-950' : res.trading_decision?.action === 'HOLD' ? 'bg-amber-500 text-zinc-950' : res.trading_decision?.action === 'WATCH' ? 'bg-indigo-500 text-white' : 'bg-rose-500 text-white'}`}>
                                      {res.trading_decision?.action || '-'}
                                    </span>
                                    <button
                                      onClick={() => {
                                        setTicker(res.ticker);
                                        analyzeTicker(res.ticker);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                      }}
                                      className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition"
                                      title="Analyze Full Chart"
                                    >
                                      <ArrowRight className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newList = watchlist.filter(t => t !== res.ticker);
                                        setWatchlist(newList);
                                        const newResults = watchlistResults.filter(r => r.ticker !== res.ticker);
                                        setWatchlistResults(newResults);
                                        localStorage.setItem('vibe_watchlist', JSON.stringify(newList));
                                        syncWatchlistToDB(newList, newResults);
                                      }}
                                      className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/20 transition"
                                      title="Remove from Watchlist"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'screener' && (
              <>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div>
                    <h3 className="text-zinc-200 font-bold text-lg flex items-center gap-2">
                      <Radar className="w-5 h-5 text-blue-400" />
                      Top Movers Screener
                    </h3>
                    <p className="text-zinc-500 text-xs mt-1">Auto-scan Yahoo Finance trending stocks</p>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <select
                      value={screenerType}
                      onChange={(e) => setScreenerType(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500 flex-1 sm:flex-none"
                    >
                      <option value="day_gainers">Top Gainers</option>
                      <option value="most_actives">Most Active</option>
                      <option value="day_losers">Top Losers</option>
                    </select>
                    {screenerResults.length > 0 && (
                      <button
                        onClick={() => setShowDynamicLevels(!showDynamicLevels)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-3 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shrink-0"
                        title={showDynamicLevels ? "Show Static Gann" : "Show Dynamic TP/SL"}
                      >
                        {showDynamicLevels ? 'Show Static Gann' : 'Show Dynamic TP/SL'}
                      </button>
                    )}
                    <button
                      onClick={scanMarket}
                      disabled={isScreening}
                      className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      <RefreshCw className={`w-4 h-4 ${isScreening ? 'animate-spin' : ''}`} />
                      {isScreening ? 'Scanning...' : 'Scan Now'}
                    </button>
                    {screenerResults.length > 0 && (
                      <button
                        onClick={() => findTopPicks()}
                        className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shrink-0"
                        title="Find Top 3 Sniper Picks"
                      >
                        <Trophy className="w-4 h-4" />
                        Top 3 Picks
                      </button>
                    )}
                  </div>
                </div>

                {isScreening ? (
                  <div className="py-12 flex flex-col items-center justify-center text-zinc-500">
                    <Radar className="w-8 h-8 animate-ping mb-4 text-blue-500/50" />
                    <p className="animate-pulse text-sm">Scanning market data and running Sniper logic...</p>
                  </div>
                ) : screenerResults.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/20 text-zinc-500 text-sm">
                    Press "Scan Now" to find top sniper setups today.
                  </div>
                ) : (
                  <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="border border-zinc-800 bg-zinc-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-900/80 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                            <th className="p-4 font-semibold pl-6 w-16">Rank</th>
                            <th className="p-4 font-semibold">Stock</th>
                            <th className="p-4 font-semibold">Score</th>
                            <th className="p-4 font-semibold">Last Price</th>
                            <th className="p-4 font-semibold text-rose-400/80">Stop Loss</th>
                            <th className="p-4 font-semibold text-emerald-400/80">TP1</th>
                            <th className="p-4 font-semibold text-emerald-400/80">TP2</th>
                            <th className="p-4 font-semibold pr-6 text-right">Act</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {screenerResults.map((res, i) => {
                            const isBuy = (res.trading_decision?.action || res.action) === 'BUY';
                            const actionText = res.trading_decision?.action || res.action || '-';
                            const scoreText = res.adaptive_sniper?.score || res.score || '0';
                            
                            return (
                              <tr key={i} className="hover:bg-zinc-800/30 transition group">
                                <td className="p-4 pl-6">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${isBuy ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                    #{i + 1}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=${res.ticker}`} target="_blank" rel="noopener noreferrer" className="font-bold text-zinc-200 hover:text-amber-400 hover:underline transition cursor-pointer">{res.ticker}</a>
                                    </div>
                                    <span className="text-[10px] text-zinc-500 line-clamp-1">{res.company_name || res.name}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className={`font-bold ${
                                    parseFloat(scoreText) >= 7.0 ? 'text-emerald-400' :
                                    parseFloat(scoreText) >= 5.0 ? 'text-amber-400' : 'text-rose-400'
                                  }`}>{scoreText}</span>
                                </td>
                                <td className="p-4 font-mono text-sm text-zinc-300">
                                  {res.technical_indicators?.current_price ? `${getCurrencySymbol(res.ticker)} ${res.technical_indicators.current_price.toFixed(2)}` : (res.price ? `${getCurrencySymbol(res.ticker)} ${parseFloat(res.price).toFixed(2)}` : '-')}
                                </td>
                                <td className="p-4 font-mono text-sm font-bold text-rose-400">
                                  {res.levels?.stop_loss ? `${getCurrencySymbol(res.ticker)} ${(showDynamicLevels || !res.levels.static_sl) ? res.levels.stop_loss.toFixed(2) : res.levels.static_sl.toFixed(2)}` : ((showDynamicLevels || !res.staticSL) ? (parseFloat(res.stopLoss) > 0 ? `${getCurrencySymbol(res.ticker)} ${parseFloat(res.stopLoss).toFixed(2)}` : '-') : (parseFloat(res.staticSL) > 0 ? `${getCurrencySymbol(res.ticker)} ${parseFloat(res.staticSL).toFixed(2)}` : '-'))}
                                </td>
                                <td className="p-4 font-mono text-sm font-medium">
                                  {res.levels?.take_profit_1 ? (
                                    <span className={`${(res.technical_indicators?.current_price || 0) >= ((showDynamicLevels || !res.levels.static_tp1) ? res.levels.take_profit_1 : res.levels.static_tp1) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>
                                      {getCurrencySymbol(res.ticker)} ${(showDynamicLevels || !res.levels.static_tp1) ? res.levels.take_profit_1.toFixed(2) : res.levels.static_tp1.toFixed(2)}
                                    </span>
                                  ) : ((showDynamicLevels || !res.staticTP1) ? (
                                    parseFloat(res.tp1) > 0 ? (
                                      <span className={`${parseFloat(res.price) >= parseFloat(res.tp1) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>
                                        {getCurrencySymbol(res.ticker)} {parseFloat(res.tp1).toFixed(2)}
                                      </span>
                                    ) : '-'
                                  ) : (
                                    parseFloat(res.staticTP1) > 0 ? (
                                      <span className={`${parseFloat(res.price) >= parseFloat(res.staticTP1) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>
                                        {getCurrencySymbol(res.ticker)} {parseFloat(res.staticTP1).toFixed(2)}
                                      </span>
                                    ) : '-'
                                  ))}
                                </td>
                                <td className="p-4 font-mono text-sm font-medium">
                                  {res.levels?.take_profit_2 ? (
                                    <span className={`${(res.technical_indicators?.current_price || 0) >= ((showDynamicLevels || !res.levels.static_tp2) ? res.levels.take_profit_2 : res.levels.static_tp2) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>
                                      {getCurrencySymbol(res.ticker)} ${(showDynamicLevels || !res.levels.static_tp2) ? res.levels.take_profit_2.toFixed(2) : res.levels.static_tp2.toFixed(2)}
                                    </span>
                                  ) : ((showDynamicLevels || !res.staticTP2) ? (
                                    parseFloat(res.tp2) > 0 ? (
                                      <span className={`${parseFloat(res.price) >= parseFloat(res.tp2) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>
                                        {getCurrencySymbol(res.ticker)} {parseFloat(res.tp2).toFixed(2)}
                                      </span>
                                    ) : '-'
                                  ) : (
                                    parseFloat(res.staticTP2) > 0 ? (
                                      <span className={`${parseFloat(res.price) >= parseFloat(res.staticTP2) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>
                                        {getCurrencySymbol(res.ticker)} {parseFloat(res.staticTP2).toFixed(2)}
                                      </span>
                                    ) : '-'
                                  ))}
                                </td>
                                <td className="p-4 pr-6">
                                  <div className="flex items-center justify-end gap-3">
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${isBuy ? 'bg-emerald-500 text-zinc-950' : actionText === 'HOLD' ? 'bg-amber-500 text-zinc-950' : actionText === 'WATCH' ? 'bg-indigo-500 text-white' : 'bg-rose-500 text-white'}`}>
                                      {actionText}
                                    </span>
                                    <button
                                      onClick={() => {
                                        setTicker(res.ticker);
                                        analyzeTicker(res.ticker);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                      }}
                                      className="p-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition"
                                      title="Analyze Full Chart"
                                    >
                                      <ArrowRight className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const isTracked = watchlist.includes(res.ticker);
                                        let newList: string[] = [];
                                        if (isTracked) {
                                          newList = watchlist.filter(t => t !== res.ticker);
                                        } else {
                                          newList = [...watchlist, res.ticker];
                                        }
                                        setWatchlist(newList);
                                        localStorage.setItem('vibe_watchlist', JSON.stringify(newList));
                                        syncWatchlistToDB(newList, watchlistResults);
                                      }}
                                      className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition"
                                      title={watchlist.includes(res.ticker) ? "Remove from Watchlist" : "Add to Watchlist"}
                                    >
                                      <Star className={`w-4 h-4 ${watchlist.includes(res.ticker) ? 'fill-amber-400' : ''}`} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        {/* US Sniper Tab */}
        {activeTab === 'us-sniper' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 p-32 bg-rose-500/5 rounded-full blur-[100px] pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-zinc-200 mb-2">🇺🇸 US Market Sniper</h3>
                  <p className="text-sm text-zinc-400">
                    Sistem akan memilih saham US yang berpotensi tinggi dari screener terpilih dan menapis kaunter yang sedang <strong>Downtrend</strong> secara automatik.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                    {usSniperView === 'scanner' ? (
                      <select
                        value={usSniperType}
                        onChange={(e) => setUsSniperType(e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 text-zinc-200 px-4 py-2.5 rounded-xl outline-none focus:border-rose-500/50 transition-colors"
                      >
                        <option value="top_swing_picks">🔥 Top 3 Swing Picks (2-5 Days)</option>
                        <option value="day_gainers">Top Gainers</option>
                        <option value="most_actives">Most Actives</option>
                        <option value="day_losers">Day Losers</option>
                        <option value="fifty_two_wk_gainers">52-Week Highs</option>
                        <option value="aggressive_small_caps">Aggressive Small Caps</option>
                        <option value="growth_technology_stocks">Growth Tech Stocks</option>
                      </select>
                    ) : null}
                    
                    {usSniperView === 'scanner' ? (
                      <button
                        onClick={fetchUsSniper}
                        disabled={isFetchingUsSniper}
                        className="bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-rose-500/20"
                      >
                        {isFetchingUsSniper ? (
                          <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Scanning...</>
                        ) : (
                          <><span className="text-lg">🎯</span> Scan US Market</>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={fetchUsWatchlist}
                        disabled={isFetchingUsWatchlist}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                      >
                        {isFetchingUsWatchlist ? (
                          <><RefreshCcw className="w-4 h-4 animate-spin" /> Refreshing...</>
                        ) : (
                          <><RefreshCcw className="w-4 h-4" /> Refresh Prices</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1 bg-zinc-950/50 p-1 rounded-xl w-fit relative z-10 mt-4 border border-zinc-800/50">
                  <button
                    onClick={() => setUsSniperView('scanner')}
                    className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${usSniperView === 'scanner' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
                  >
                    Live Scanner
                  </button>
                  <button
                    onClick={() => setUsSniperView('watchlist')}
                    className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${usSniperView === 'watchlist' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
                  >
                    Saved Watchlist
                  </button>
                </div>
              </div>

            {liveError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                {liveError}
              </div>
            )}

            {(usSniperView === 'scanner' ? usSniperResults : usWatchlist).length > 0 && (() => {
              const dataSource = usSniperView === 'scanner' ? usSniperResults.slice(0, usSniperType === 'top_swing_picks' ? 3 : usSniperResults.length) : usWatchlist;
              return (
              <div className="border border-zinc-800 bg-zinc-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl mt-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-900/80 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                        <th className="p-4 font-semibold pl-6 w-16">Rank</th>
                        <th className="p-4 font-semibold w-48">Stock</th>
                        <th className="p-4 font-semibold w-24">Score</th>
                        {usSniperView !== 'scanner' && (
                          <th className="p-4 font-semibold w-32">
                            <div className="flex flex-col">
                              <span>Last Done</span>
                              <span className="text-[10px] text-zinc-500 font-normal capitalize">
                                {usWatchlist.length > 0 ? usWatchlist[0].lastDoneDate : '(Date)'}
                              </span>
                            </div>
                          </th>
                        )}
                        <th className="p-4 font-semibold w-24">Last Price</th>
                        <th className="p-4 font-semibold text-rose-400/80 w-32">Stop Loss</th>
                        <th className="p-4 font-semibold text-emerald-400/80 w-32">TP1</th>
                        <th className="p-4 font-semibold text-emerald-400/80 w-32">TP2</th>
                        {usSniperView !== 'scanner' && (
                          <>
                            <th className="p-4 font-semibold text-emerald-400/80 w-32">TP3</th>
                            <th className="p-4 font-semibold text-emerald-400/80 w-32">TP4</th>
                          </>
                        )}
                        
                        <th className="p-4 font-semibold pr-6 w-32">Highest (This Week)</th>
                        <th className="p-4 font-semibold w-12 text-center text-zinc-500">Act</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {dataSource.map((row, idx) => (
                        <tr key={idx} className="hover:bg-zinc-800/30 transition group">
                          <td className="p-4 pl-6">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-500/10 text-rose-500 font-bold text-xs border border-rose-500/20">
                              #{idx + 1}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=${row.ticker}`} target="_blank" rel="noopener noreferrer" className="font-bold text-zinc-200 hover:text-rose-400 hover:underline transition cursor-pointer">{row.name}</a>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-zinc-500 font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded">{row.ticker}</span>
                                {row.category && (
                                  <span className="text-[9px] font-bold text-indigo-400/80 uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                                    {row.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`font-bold ${parseFloat(row.score) >= 7.0 ? 'text-emerald-400' : 'text-amber-400'}`}>{row.score}/10</span>
                          </td>
                          {usSniperView !== 'scanner' && (
                            <td className="p-4 font-mono text-sm text-zinc-300">
                              ${row.price}
                            </td>
                          )}
                          <td className="p-4">
                            {(() => {
                              const cur = parseFloat(row.currentPrice || row.price);
                              const isGolden = cur > parseFloat(row.staticSL) && cur < parseFloat(row.staticTP1) && cur > parseFloat(row.price);
                              return (
                                <div className={`flex w-fit items-center gap-1.5 font-mono text-sm ${isGolden ? 'bg-emerald-600 text-white px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(5,150,105,0.6)]' : 'text-zinc-300'}`}>
                                  <span className={isGolden ? 'font-bold' : ''}>${row.currentPrice || row.price}</span>
                                  {cur > parseFloat(row.price) ? (
                                    <TrendingUp className={`w-3.5 h-3.5 ${isGolden ? 'text-white' : 'text-emerald-400'}`} />
                                  ) : cur < parseFloat(row.price) ? (
                                    <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                                  ) : null}
                                </div>
                              );
                            })()}
                          </td>
                          <td className={`p-4`}>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${row.staticSLColor === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                <span className={`font-mono text-sm font-medium ${parseFloat(row.currentPrice || row.price) < parseFloat(row.staticSL) ? 'bg-rose-600 text-white px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.6)]' : 'text-rose-400'}`}>${row.staticSL}</span>
                              </div>
                              {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.currentPrice || row.price) <= parseFloat(row.stopLoss) ? 'text-rose-500' : 'text-rose-400/50'}`}>${row.stopLoss}</span>}
                            </div>
                          </td>
                          <td className={`p-4`}>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP1Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP1) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>${row.staticTP1}</span>
                              </div>
                              {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp1) || row.hitTp1 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>${row.tp1}</span>}
                            </div>
                          </td>
                          <td className={`p-4`}>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP2Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP2) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>${row.staticTP2}</span>
                              </div>
                              {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp2) || row.hitTp2 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>${row.tp2}</span>}
                            </div>
                          </td>
                          {usSniperView !== 'scanner' && (
                            <>
                              <td className={`p-4`}>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP3Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                    <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP3) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>${row.staticTP3}</span>
                                  </div>
                                  {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp3) || row.hitTp3 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>${row.tp3}</span>}
                                </div>
                              </td>
                              <td className={`p-4`}>
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP4Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                    <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP4) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>${row.staticTP4}</span>
                                  </div>
                                  {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp4) || row.hitTp4 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>${row.tp4}</span>}
                                </div>
                              </td>
                            </>
                          )}
                          
                          <td className="p-4 font-mono text-sm text-zinc-500 pr-6">${row.highestPrice}</td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {usSniperView === 'scanner' ? (
                                <>
                                  <button 
                                    onClick={() => saveToUsWatchlist(row)} 
                                    disabled={isSavingUsWatchlist || usWatchlist.some(w => w.ticker === row.ticker)} 
                                    className={`transition-colors p-2 rounded-lg ${usWatchlist.some(w => w.ticker === row.ticker) ? 'text-emerald-500 bg-emerald-500/10' : 'text-zinc-600 hover:text-emerald-500 bg-zinc-800/50 hover:bg-emerald-500/10'} disabled:opacity-50`}
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => removeUsSniperResult(row.ticker)} className="text-zinc-600 hover:text-red-500 transition-colors bg-zinc-800/50 hover:bg-red-500/10 p-2 rounded-lg">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => removeFromUsWatchlist(row.ticker)} className="text-zinc-600 hover:text-red-500 transition-colors bg-zinc-800/50 hover:bg-red-500/10 p-2 rounded-lg">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })()}
          </div>
        )}
        </div>

        {/* Results Screen */}
        {loading && !result && (
          <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/20 border border-zinc-800/30 rounded-3xl backdrop-blur-sm animate-pulse">
            <span className="w-10 h-10 border-3 border-zinc-700 border-t-blue-500 rounded-full animate-spin mb-4" />
            <p className="text-zinc-500 text-sm font-medium font-mono">Running Adaptive Sniper simulation...</p>
          </div>
        )}

        {result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 1. Decision Header */}
            {(() => {
              const trend = result.adaptive_sniper?.trend;
              const confidence = result.trading_decision?.confidence_level;
              const styles = getActionStyles(result.trading_decision.action, trend, confidence);
              return (
                <div className={`border bg-gradient-to-br ${styles.bg} p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-3xl md:text-4xl font-extrabold tracking-wider font-mono text-white">
                        {result.ticker}
                      </h2>
                      <button
                        onClick={() => toggleWatchlist(result.ticker)}
                        className={`p-2 rounded-xl transition ${watchlist.includes(result.ticker) ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
                        title={watchlist.includes(result.ticker) ? 'Remove from Watchlist' : 'Add to Watchlist'}
                      >
                        <Star className={`w-5 h-5 ${watchlist.includes(result.ticker) ? 'fill-amber-400' : ''}`} />
                      </button>
                      <div className="flex items-center gap-2">
                        <span className={`px-4 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-widest shadow-md ${styles.badge}`}>
                          {result.trading_decision.action}
                        </span>
                        <span className="bg-zinc-900/60 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5">
                          {result.trading_decision.confidence_level === 'High' ? (
                            <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <BadgeAlert className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          Conf: {result.trading_decision.confidence_level}
                        </span>
                      </div>
                    </div>
                    {result.company_name && (
                      <div className="text-sm text-zinc-400 font-sans tracking-wide">
                        {result.company_name}
                      </div>
                    )}
                    <p className="text-zinc-300 text-sm md:text-base font-medium mt-2">
                      {result.trading_decision.reasoning}
                    </p>
                  </div>
                  
                  {/* Current Price Display */}
                  {result.technical_indicators && (
                    <div className="bg-zinc-950/60 border border-zinc-800 p-4 rounded-2xl min-w-[150px] text-right flex flex-col justify-center">
                      <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">
                        Current Price
                      </span>
                      <span className="text-2xl font-bold font-mono text-zinc-100">
                        {cSym} {result.technical_indicators.current_price.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2. Main Confluence and Target levels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Target Levels Card */}
              <div className="md:col-span-2 bg-zinc-900/30 border border-zinc-800/80 p-6 rounded-3xl backdrop-blur-md flex flex-col justify-between space-y-6">
                <div>
                  <h3 className="text-zinc-200 font-bold text-lg flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-blue-400" />
                    Adaptive Sniper Swing Levels
                  </h3>

                  {result.trading_decision.action === 'AVOID' ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-zinc-805 rounded-2xl bg-zinc-950/40">
                      <ShieldAlert className="w-10 h-10 text-rose-500/80 mb-3" />
                      <p className="text-zinc-400 text-sm font-semibold mb-1">Status: AVOID</p>
                      <p className="text-zinc-500 text-xs max-w-sm px-4">
                        Market structure is bearish or neutral. Adaptive Sniper recommends avoiding this ticker until momentum shifts.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {/* Entry Price */}
                        <div className="bg-zinc-950/50 border border-zinc-850 p-3 rounded-2xl">
                          <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">
                            Entry Price
                          </span>
                          <span className="text-sm sm:text-base font-bold font-mono text-blue-400 block">
                            {cSym} {result.levels.entry_price.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-zinc-500 block mt-1">Sniper Trigger</span>
                        </div>

                        {/* Stop Loss */}
                        <div className="bg-zinc-950/50 border border-zinc-850 p-3 rounded-2xl">
                          <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">
                            Stop Loss (SL)
                          </span>
                          <span className="text-sm sm:text-base font-bold font-mono text-rose-400 block">
                            {cSym} {(showDynamicLevels || !result.levels.static_sl) ? result.levels.stop_loss.toFixed(2) : result.levels.static_sl.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-zinc-500 block mt-1">
                            {showDynamicLevels ? 'ATR / Swing Low' : 'Gann Support'}
                          </span>
                        </div>

                        {/* Take Profit 1 */}
                        <div className="bg-zinc-950/50 border border-zinc-850 p-3 rounded-2xl">
                          <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">
                            Target 1 (TP1)
                          </span>
                          <span className={`text-sm sm:text-base font-bold font-mono block w-fit ${(result.technical_indicators?.current_price || 0) >= ((showDynamicLevels || !result.levels.static_tp1) ? result.levels.take_profit_1 : result.levels.static_tp1) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded -ml-1' : 'text-emerald-400'}`}>
                            {cSym} {(showDynamicLevels || !result.levels.static_tp1) ? result.levels.take_profit_1.toFixed(2) : result.levels.static_tp1.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-zinc-500 block mt-1">
                            {showDynamicLevels ? '1.0x R:R Target' : 'Gann Resistance'}
                          </span>
                        </div>

                        {/* Take Profit 2 */}
                        <div className="bg-zinc-950/50 border border-zinc-850 p-3 rounded-2xl">
                          <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">
                            Target 2 (TP2)
                          </span>
                          <span className={`text-sm sm:text-base font-bold font-mono block w-fit ${(result.technical_indicators?.current_price || 0) >= ((showDynamicLevels || !result.levels.static_tp2) ? result.levels.take_profit_2 : result.levels.static_tp2) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded -ml-1' : 'text-purple-400'}`}>
                            {cSym} {(showDynamicLevels || !result.levels.static_tp2) ? result.levels.take_profit_2.toFixed(2) : result.levels.static_tp2.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-zinc-500 block mt-1">
                            {showDynamicLevels ? '2.0x R:R Target' : 'Gann Resistance'}
                          </span>
                        </div>

                        {/* Take Profit 3 */}
                        <div className="bg-zinc-950/50 border border-zinc-850 p-3 rounded-2xl">
                          <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block mb-1">
                            Target 3 (TP3)
                          </span>
                          <span className="text-sm sm:text-base font-bold font-mono text-cyan-400 block">
                            {cSym} {result.levels.take_profit_3 ? result.levels.take_profit_3.toFixed(2) : '0.00'}
                          </span>
                          <span className="text-[9px] text-zinc-500 block mt-1">3.0x R:R Target</span>
                        </div>
                      </div>

                      {/* Support & Resistance info badge */}
                      {result.levels.support && result.levels.resistance && (
                        <div className="flex flex-wrap gap-3 pt-4 border-t border-zinc-850/40 mt-4 text-[11px]">
                          <div className="flex items-center gap-1.5 bg-zinc-950/40 border border-zinc-850/80 px-3 py-1.5 rounded-xl">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-zinc-500 font-medium">Nearest Support (10D Swing Low):</span>
                            <span className="text-zinc-200 font-mono font-semibold">{cSym} {result.levels.support.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-zinc-950/40 border border-zinc-850/80 px-3 py-1.5 rounded-xl">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            <span className="text-zinc-500 font-medium">Nearest Resistance (10D Swing High):</span>
                            <span className="text-zinc-200 font-mono font-semibold">{cSym} {result.levels.resistance.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Risk-Reward Visualizer */}
                {result.trading_decision.action !== 'AVOID' && (
                  <div className="bg-zinc-950/40 border border-zinc-850 p-5 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400 font-medium">Risk : Reward Ratio Visualization</span>
                      <span className="text-zinc-300 font-semibold font-mono bg-zinc-900 px-2 py-0.5 rounded-lg border border-zinc-800">
                        R:R Ratio = 1 : {calculateRRRatio(result.levels.entry_price, result.levels.stop_loss, result.levels.take_profit_2)} (TP2)
                      </span>
                    </div>

                    {/* Price Marker Above the Bar */}
                    <div className="relative h-6 w-full mb-1">
                      <div 
                        className="absolute -translate-x-1/2 flex flex-col items-center transition-all duration-500 ease-out"
                        style={{ left: `${lastPricePercent}%` }}
                      >
                        <span className="bg-zinc-800 border border-zinc-700 text-[9px] font-bold text-zinc-200 px-1.5 py-0.5 rounded shadow-md whitespace-nowrap mb-0.5">
                          Last: {cSym}{result.technical_indicators?.current_price.toFixed(2)}
                        </span>
                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-zinc-400" />
                      </div>
                    </div>

                    {/* Progress Bar with 4 Equal 25% Segments */}
                    <div className="relative h-2 bg-zinc-850 rounded-full overflow-hidden flex">
                      <div className="bg-rose-500/80 h-full w-1/2" title="Risk Zone (SL to Entry)" />
                      <div className="bg-emerald-500/80 h-full w-1/2" title="TP1 Zone (Entry to TP1)" />
                      <div className="bg-purple-500/80 h-full w-1/2" title="TP2 Zone (TP1 to TP2)" />
                      <div className="bg-cyan-500/80 h-full w-1/2" title="TP3 Zone (TP2 to TP3)" />
                    </div>

                    {/* Mathematically Aligned Labels */}
                    <div className="relative h-4 text-[10px] text-zinc-500 font-mono mt-1">
                      <span className="absolute left-0">SL ({cSym}{result.levels.stop_loss.toFixed(2)})</span>
                      <span className="absolute left-1/4 -translate-x-1/2">Entry ({cSym}{result.levels.entry_price.toFixed(2)})</span>
                      <span className="absolute left-1/2 -translate-x-1/2">TP1 ({cSym}{result.levels.take_profit_1.toFixed(2)})</span>
                      <span className="absolute left-[75%] -translate-x-1/2">TP2 ({cSym}{result.levels.take_profit_2.toFixed(2)})</span>
                      
                    </div>
                  </div>
                )}
                
                {/* Gann Square of 9 (Static Crosses) */}
                {result.technical_indicators?.current_price && (
                  <div className="bg-zinc-950/40 border border-zinc-850 p-5 rounded-2xl mt-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-zinc-200 font-bold text-sm flex items-center gap-2">
                        <Target className="w-4 h-4 text-indigo-400" />
                        Gann Square of 9 (Static Crosses)
                      </h4>
                      <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800/80">
                        <button 
                          onClick={() => setIsGannIntraday(false)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${!isGannIntraday ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}
                        >
                          Swing (1-5 Days)
                        </button>
                        <button 
                          onClick={() => setIsGannIntraday(true)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${isGannIntraday ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}
                        >
                          Intraday (x100)
                        </button>
                      </div>
                    </div>
                    
                    {(() => {
                      const gann = getStaticGannTargets(result.technical_indicators.current_price, isGannIntraday ? 100 : 1);
                      return (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex flex-col gap-1.5 bg-zinc-900/50 border border-zinc-800/80 px-4 py-2.5 rounded-xl min-w-[90px]">
                            <span className="text-[10px] text-zinc-500 font-bold tracking-wider">STOP LOSS</span>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${gann.staticSLColor === 'blue' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`} />
                              <span className="font-mono font-bold text-rose-400">{cSym}{gann.staticSL}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-1.5 bg-zinc-900/50 border border-zinc-800/80 px-4 py-2.5 rounded-xl min-w-[90px]">
                            <span className="text-[10px] text-zinc-500 font-bold tracking-wider">TARGET 1</span>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${gann.staticTP1Color === 'blue' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`} />
                              <span className="font-mono font-bold text-emerald-400">{cSym}{gann.staticTP1}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-1.5 bg-zinc-900/50 border border-zinc-800/80 px-4 py-2.5 rounded-xl min-w-[90px]">
                            <span className="text-[10px] text-zinc-500 font-bold tracking-wider">TARGET 2</span>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${gann.staticTP2Color === 'blue' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`} />
                              <span className="font-mono font-bold text-emerald-400">{cSym}{gann.staticTP2}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-1.5 bg-zinc-900/50 border border-zinc-800/80 px-4 py-2.5 rounded-xl min-w-[90px]">
                            <span className="text-[10px] text-zinc-500 font-bold tracking-wider">TARGET 3</span>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${gann.staticTP3Color === 'blue' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`} />
                              <span className="font-mono font-bold text-emerald-400">{cSym}{gann.staticTP3}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-1.5 bg-zinc-900/50 border border-zinc-800/80 px-4 py-2.5 rounded-xl min-w-[90px]">
                            <span className="text-[10px] text-zinc-500 font-bold tracking-wider">TARGET 4</span>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${gann.staticTP4Color === 'blue' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'}`} />
                              <span className="font-mono font-bold text-emerald-400">{cSym}{gann.staticTP4}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-6">
                {/* Adaptive Sniper Dashboard */}
                <div className="bg-zinc-900/30 border border-zinc-800/80 p-6 rounded-3xl backdrop-blur-md flex flex-col justify-between">
                  <div>
                    <h3 className="text-zinc-200 font-bold text-lg flex items-center gap-2 mb-4">
                      <Activity className="w-5 h-5 text-indigo-400" />
                      Adaptive Sniper Dashboard
                    </h3>
                    
                    {result.adaptive_sniper ? (
                      <div className="divide-y divide-zinc-850">
                        {/* Trend */}
                        <div className="flex justify-between items-center py-2">
                          <span className="text-zinc-400 text-xs font-semibold">Trend</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                            result.adaptive_sniper.trend === 'Bullish' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            result.adaptive_sniper.trend === 'Bearish' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            'bg-zinc-800 text-zinc-400'
                          }`}>
                            {result.adaptive_sniper.trend}
                          </span>
                        </div>

                        {/* Score */}
                        <div className="flex justify-between items-center py-2">
                          <span className="text-zinc-400 text-xs font-semibold">Score</span>
                          <span className={`text-xs font-mono font-bold ${
                            parseFloat(result.adaptive_sniper.score) >= 7.0 ? 'text-emerald-400' :
                            parseFloat(result.adaptive_sniper.score) >= 5.0 ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            {result.adaptive_sniper.score}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="flex justify-between items-center py-2">
                          <span className="text-zinc-400 text-xs font-semibold">Status</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                            result.adaptive_sniper.status.includes('TP') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            result.adaptive_sniper.status === 'Active' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                            'bg-zinc-800 text-zinc-400'
                          }`}>
                            {result.adaptive_sniper.status}
                          </span>
                        </div>

                        {/* HTF Bias */}
                        <div className="flex justify-between items-center py-2">
                          <span className="text-zinc-400 text-xs font-semibold">HTF Bias</span>
                          <span className={`text-xs font-bold ${
                            result.adaptive_sniper.htf_bias === 'Bullish' ? 'text-emerald-400' :
                            result.adaptive_sniper.htf_bias === 'Bearish' ? 'text-rose-400' : 'text-zinc-400'
                          }`}>
                            {result.adaptive_sniper.htf_bias}
                          </span>
                        </div>

                        {/* Volatility */}
                        <div className="flex justify-between items-center py-2">
                          <span className="text-zinc-400 text-xs font-semibold">Volatility</span>
                          <span className={`text-xs font-bold ${
                            result.adaptive_sniper.volatility === 'High' ? 'text-rose-400' :
                            result.adaptive_sniper.volatility === 'Low' ? 'text-zinc-500' : 'text-emerald-400'
                          }`}>
                            {result.adaptive_sniper.volatility}
                          </span>
                        </div>

                        {/* RSI & ADX */}
                        <div className="flex justify-between items-center py-2">
                          <span className="text-zinc-400 text-xs font-semibold">RSI (21) / ADX (14)</span>
                          <span className="text-xs font-mono font-bold text-zinc-200">
                            {result.adaptive_sniper.rsi} / {result.adaptive_sniper.adx}
                          </span>
                        </div>

                        {/* Market / Preset */}
                        <div className="flex justify-between items-center py-2">
                          <span className="text-zinc-400 text-xs font-semibold">Exchange / Preset</span>
                          <span className="text-xs font-bold text-zinc-300">
                            {result.adaptive_sniper.market} → {result.adaptive_sniper.preset} (1D)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-zinc-500 text-xs py-4 text-center">Dashboard not loaded.</div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-zinc-850 mt-4 text-[10px] text-zinc-500 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>Adaptive Sniper model v2.0.0 metrics.</span>
                  </div>
                </div>

                {/* Backtest Results */}
                {result.backtest && (
                  <div className="bg-zinc-900/30 border border-zinc-800/80 p-6 rounded-3xl backdrop-blur-md flex flex-col justify-between">
                    <div>
                      <h3 className="text-zinc-200 font-bold text-lg flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                        6-Month Backtest Results
                      </h3>
                      
                      <div className="divide-y divide-zinc-850">
                        {/* Win Rate */}
                        <div className="flex justify-between items-center py-3">
                          <span className="text-zinc-400 text-xs font-semibold">Win Rate (Hit TP1)</span>
                          <span className={`text-xl font-mono font-bold ${
                            parseFloat(result.backtest.win_rate) >= 60.0 ? 'text-emerald-400' :
                            parseFloat(result.backtest.win_rate) >= 40.0 ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            {result.backtest.win_rate}%
                          </span>
                        </div>
                        
                        {/* Reliability Badge */}
                        {parseFloat(result.backtest.win_rate) >= 60.0 && result.backtest.total_trades >= 3 && (
                          <div className="flex items-center gap-2 py-3">
                            <BadgeCheck className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Highly Reliable</span>
                          </div>
                        )}

                        {/* Total Signals */}
                        <div className="flex justify-between items-center py-3">
                          <span className="text-zinc-400 text-xs font-semibold">Total Signals</span>
                          <span className="text-sm font-bold text-zinc-300">
                            {result.backtest.total_trades} Trades
                          </span>
                        </div>

                        {/* Wins vs Losses */}
                        <div className="flex justify-between items-center py-3">
                          <span className="text-zinc-400 text-xs font-semibold">Wins / Losses</span>
                          <span className="text-xs font-mono font-bold text-zinc-200">
                            <span className="text-emerald-400">{result.backtest.winning_trades}</span> / <span className="text-rose-400">{result.backtest.total_trades - result.backtest.winning_trades}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-850 mt-4 text-[10px] text-zinc-500 flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 shrink-0" />
                      <span>Based on daily simulated trades.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Detailed Confluence Explanation */}
            <div className="bg-zinc-900/30 border border-zinc-800/80 p-6 rounded-3xl backdrop-blur-md space-y-4">
              <h3 className="text-zinc-200 font-bold text-lg flex items-center gap-2">
                <Compass className="w-5 h-5 text-purple-400" />
                Adaptive Sniper Confluence Commentary
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="bg-zinc-950/40 border border-zinc-850 p-5 rounded-2xl space-y-2">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Confluence Analysis</h4>
                  <p className="text-zinc-300 leading-relaxed text-xs md:text-sm">
                    {result.trend_analysis.gann_confluence || 'Please run analysis for more information.'}
                  </p>
                </div>

                <div className="bg-zinc-950/40 border border-zinc-850 p-5 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Trend Structure</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-300 font-medium">Current Structure:</span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                      result.trend_analysis.market_structure.includes('Uptrend') || result.trend_analysis.market_structure.includes('Bullish') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                      result.trend_analysis.market_structure.includes('Downtrend') || result.trend_analysis.market_structure.includes('Bearish') ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' :
                      'bg-zinc-800 border border-zinc-700 text-zinc-400'
                    }`}>
                      {(result.trend_analysis.market_structure.includes('Uptrend') || result.trend_analysis.market_structure.includes('Bullish')) ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (result.trend_analysis.market_structure.includes('Downtrend') || result.trend_analysis.market_structure.includes('Bearish')) ? (
                        <TrendingDown className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowRight className="w-3.5 h-3.5" />
                      )}
                      {result.trend_analysis.market_structure}
                    </span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed text-xs">
                    {(result.trend_analysis.market_structure.includes('Uptrend') || result.trend_analysis.market_structure.includes('Bullish'))
                      ? 'Price remains stable above the EMA trend line, confirming buyers hold short to medium-term trend control.' 
                      : (result.trend_analysis.market_structure.includes('Downtrend') || result.trend_analysis.market_structure.includes('Bearish'))
                      ? 'Price is below the EMA trend line, indicating seller dominance. Any entry is high risk.' 
                      : 'Price is crossing the EMA lines in a consolidation phase. Waiting for a strong directional signal.'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Market News Sentiment */}
            {(loadingNews || newsResult) && (
              <div className="bg-zinc-900/30 border border-zinc-800/80 p-6 rounded-3xl backdrop-blur-md space-y-4">
                <h3 className="text-zinc-200 font-bold text-lg flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-blue-400" />
                  Market News Sentiment (AI)
                </h3>
                
                {loadingNews ? (
                  <div className="flex items-center gap-3 text-zinc-500 py-4">
                    <span className="w-5 h-5 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
                    <span className="text-sm font-mono">Reading latest news headlines...</span>
                  </div>
                ) : newsResult && !newsResult.error ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className={`p-5 rounded-2xl border flex flex-col justify-center items-center text-center gap-2 ${
                      newsResult.sentiment === 'Bullish' ? 'bg-emerald-500/10 border-emerald-500/20' :
                      newsResult.sentiment === 'Bearish' ? 'bg-rose-500/10 border-rose-500/20' :
                      'bg-zinc-800/50 border-zinc-700'
                    }`}>
                      <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">AI Sentiment</span>
                      <span className={`text-2xl font-black tracking-wider uppercase ${
                        newsResult.sentiment === 'Bullish' ? 'text-emerald-400' :
                        newsResult.sentiment === 'Bearish' ? 'text-rose-400' :
                        'text-zinc-300'
                      }`}>{newsResult.sentiment}</span>
                    </div>
                    <div className="md:col-span-2 bg-zinc-950/40 border border-zinc-850 p-5 rounded-2xl">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">AI Summary</h4>
                      <p className="text-zinc-300 leading-relaxed text-sm">
                        {newsResult.summary}
                      </p>
                      
                      {newsResult.articles && newsResult.articles.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-zinc-800/50">
                          <h4 className="text-xs font-bold text-zinc-500 mb-2">Recent Headlines</h4>
                          <ul className="space-y-1.5">
                            {newsResult.articles.slice(0, 3).map((a: any, i: number) => (
                              <li key={i} className="text-xs">
                                <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition line-clamp-1">
                                  {a.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ) : newsResult && newsResult.error ? (
                  <div className="text-sm text-rose-400 bg-rose-500/10 p-4 rounded-xl border border-rose-500/20">
                    Failed to analyze sentiment: {newsResult.error}
                  </div>
                ) : null}
              </div>
            )}

          </div>
        )}

        {/* Calculator Tab */}
        {activeTab === 'calculator' && (
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl mb-8">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-zinc-100 flex items-center gap-3">
                Trailing Stop Reference
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Calculate trailing stop prices based on percentage drops
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  Ticker Symbol (Optional)
                </label>
                <input
                  type="text"
                  value={calcTicker}
                  onChange={(e) => setCalcTicker(e.target.value)}
                  placeholder="e.g. CRDO"
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 transition font-mono uppercase"
                  onKeyDown={(e) => e.key === 'Enter' && fetchCalcPrice()}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  Reference Price (USD)
                </label>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">$</span>
                      <input
                        type="number"
                        step="0.001"
                        value={calcPrice}
                        onChange={(e) => setCalcPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl pl-8 pr-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50 transition font-mono"
                      />
                    </div>
                    <button
                      onClick={fetchCalcPrice}
                      disabled={!calcTicker || isCalcFetching}
                      className="w-12 flex-shrink-0 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center justify-center transition disabled:opacity-50"
                    >
                      {isCalcFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
                    </button>
                  </div>
                  {calcCompany && (
                    <div className="text-zinc-100/90 text-[11px] sm:text-xs flex items-center gap-1.5 mt-1 font-medium">
                      <Check className="w-3.5 h-3.5" /> Last price from Yahoo Finance: ${parseFloat(calcPrice).toFixed(4)} • {calcTicker.toUpperCase()} ({calcCompany}) • fetched {calcLastFetch}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {calcError && (
              <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {calcError}
              </div>
            )}


            {calcRecent.length > 0 && (
              <div className="flex items-center gap-2 mb-8">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Recent:</span>
                <div className="flex gap-2">
                  {calcRecent.map(t => (
                    <button
                      key={t}
                      onClick={() => {
                        setCalcTicker(t);
                        // Trigger fetch with this ticker. 
                        // Note: state update is async, so we pass it explicitly or rely on a useEffect.
                        // Since we can't easily pass it to fetchCalcPrice without refactoring, 
                        // we'll just set it and the user can click fetch, or we update fetchCalcPrice to accept a parameter.
                        // Let's rely on the setCalcTicker for now.
                      }}
                      className="bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 rounded-full px-3 py-1 text-xs font-mono text-zinc-300 transition"
                    >
                      {t}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setCalcRecent([]);
                      setCalcTicker('');
                      setCalcPrice('');
                      setCalcCompany('');
                      setCalcError('');
                    }}
                    className="p-1 text-zinc-500 hover:text-rose-400 transition ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {calcPrice && !isNaN(parseFloat(calcPrice)) && (
              <div className="grid grid-cols-2 md:grid-cols-5 border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/40">
                {[-0.2, -0.3, -0.5, -0.7, -1, -1.5, -2, -2.5, -3, -3.5].map((pct, i) => {
                  const price = parseFloat(calcPrice) * (1 + pct / 100);
                  return (
                    <div key={i} className="p-4 border-r border-b border-zinc-800/50 flex flex-col items-center justify-center gap-1.5 hover:bg-zinc-900/50 transition">
                      <span className="text-xs font-mono font-bold text-zinc-300">{pct}%</span>
                      <span className="text-[15px] font-black font-mono text-emerald-400">${price.toFixed(3)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        
        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-2xl w-full max-w-lg relative animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => setShowImportModal(false)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-xl font-bold text-zinc-100 flex items-center gap-2 mb-2">
                <ClipboardPaste className="w-5 h-5 text-indigo-400" />
                Smart Paste Import
              </h3>
              <p className="text-sm text-zinc-400 mb-6">
                Copy the entire table from <strong>Finviz.com</strong> (Ctrl+A, Ctrl+C) and paste it below. We will automatically extract the tickers for you. You can also paste a comma-separated list of tickers.
              </p>
              
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"1 AVLV Avantis U.S. Large Cap Value ETF... \\n2 AXGN Axogen Inc..."}
                className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-300 text-sm font-mono focus:outline-none focus:border-indigo-500 resize-none mb-6"
              />
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-bold transition shadow-lg shadow-indigo-900/20"
                >
                  Extract & Import
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
