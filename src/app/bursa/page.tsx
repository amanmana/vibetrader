"use client";

import { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Loader2, AlertCircle, Copy, Check, Power, RefreshCcw, Trash2, Save } from 'lucide-react';

interface BursaStock {
  stock_name: string;
  last_done: string;
  target: string;
  highest_price: string;
  tp2: string;
  status: 'Hit TP' | 'On Going' | 'Belum Gerak';
}

export default function BursaPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [results, setResults] = useState<BursaStock[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  
  const [isScanningTop5, setIsScanningTop5] = useState(false);
  const [top5Results, setTop5Results] = useState<any[]>([]);
  const [top5Error, setTop5Error] = useState('');
  
  const [activeTab, setActiveTab] = useState<'ocr' | 'live' | 'custom' | 'customMaster' | 'us'>('customMaster');
  const [customText, setCustomText] = useState('');
  const [isLiveScanning, setIsLiveScanning] = useState(false);
  const [isUpdatingMaster, setIsUpdatingMaster] = useState(false);
  const [liveResults, setLiveResults] = useState<any[]>([]);
  const [liveError, setLiveError] = useState('');
  const [lastMasterUpdate, setLastMasterUpdate] = useState<string | null>(null);

  const [customMasterResults, setCustomMasterResults] = useState<any[]>([]);
  const [lastCustomMasterUpdate, setLastCustomMasterUpdate] = useState<string | null>(null);
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [isFetchingCustomMaster, setIsFetchingCustomMaster] = useState(false);

  const [showDynamic, setShowDynamic] = useState(false);
  const [showSniperDynamic, setShowSniperDynamic] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchedStock, setSearchedStock] = useState<any | null>(null);

  const [usSniperResults, setUsSniperResults] = useState<any[]>([]);
  const [isFetchingUsSniper, setIsFetchingUsSniper] = useState(false);
  const [usSniperType, setUsSniperType] = useState('top_swing_picks');
  const [usSniperView, setUsSniperView] = useState<'scanner' | 'watchlist'>('scanner');
  const [usWatchlist, setUsWatchlist] = useState<any[]>([]);
  const [isFetchingUsWatchlist, setIsFetchingUsWatchlist] = useState(false);
  const [isSavingUsWatchlist, setIsSavingUsWatchlist] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load state from local storage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('vibeTraderAiEnabled');
    if (savedState !== null) {
      setIsAiEnabled(savedState === 'true');
    }
    
    const savedResults = localStorage.getItem('bursaOcrResults');
    if (savedResults) {
      try {
        setResults(JSON.parse(savedResults));
      } catch (e) {
        console.error("Failed to parse saved results");
      }
    }
  }, []);

  // Handle global paste event
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleProcessImage(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Fetch daily live picks on mount
  useEffect(() => {
    async function fetchDailyPicks() {
      if (activeTab !== 'live') return;
      if (liveResults.length > 0) return;
      
      setIsLiveScanning(true);
      try {
        const res = await fetch('/api/bursa-daily-picks');
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
        setLiveResults(data.data);
        setLastMasterUpdate(new Date().toISOString());
      } else {  if (data.lastUpdated) {
            setLastMasterUpdate(data.lastUpdated);
          }
        }
      } catch (e) {
        console.error("Failed to fetch daily picks:", e);
      } finally {
        setIsLiveScanning(false);
      }
    }
    fetchDailyPicks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Fetch custom master picks on mount
  useEffect(() => {
    async function fetchCustomMasterPicks() {
      if (activeTab !== 'customMaster') return;
      if (customMasterResults.length > 0) return;
      
      setIsFetchingCustomMaster(true);
      try {
        const res = await fetch('/api/bursa-custom-picks');
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
          setCustomMasterResults(data.data);
          setLastCustomMasterUpdate(new Date().toISOString());
        } else if (data.lastUpdated) {
          setLastCustomMasterUpdate(data.lastUpdated);
        }
      } catch (e) {
        console.error("Failed to fetch custom picks:", e);
      } finally {
        setIsFetchingCustomMaster(false);
      }
    }
    fetchCustomMasterPicks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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
      await fetch('/api/us-custom-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      alert(`${row.ticker} saved to Watchlist!`);
      // Optionally re-fetch watchlist if we are on that view, or just fetch it when they switch tab.
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
    if (activeTab === 'us' && usSniperView === 'scanner' && usSniperResults.length === 0) {
      fetchUsSniper();
    }
    if (activeTab === 'us' && usSniperView === 'watchlist' && usWatchlist.length === 0) {
      fetchUsWatchlist();
    }
  }, [activeTab, usSniperType, usSniperView]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        handleProcessImage(file);
      } else {
        setError('Please drop a valid image file.');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleProcessImage(e.target.files[0]);
    }
  };

  const handleProcessImage = async (file: File) => {
    if (!isAiEnabled) {
      setError('AI Scanner is currently disabled. Please enable it to process images.');
      return;
    }

    setError('');
    setResults([]);
    setIsProcessing(true);

    // Create a preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/bursa-ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process image');
      }

      if (data.success && data.data) {
        setResults(data.data);
        localStorage.setItem('bursaOcrResults', JSON.stringify(data.data));
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred while processing the image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScanTop5 = async () => {
    setTop5Error('');
    setTop5Results([]);
    setIsScanningTop5(true);
    
    try {
      // Extract stock names from results, removing [S]
      const stocks = results.map(r => r.stock_name.replace('[S]', '').trim());
      
      const response = await fetch('/api/bursa-sniper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stocks })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to scan stocks');
      
      const enrichedData = data.data.map((item: any) => {
        const match = results.find(r => r.stock_name.replace('[S]', '').trim().toUpperCase() === (item.originalName || '').toUpperCase());
        return {
          ...item,
          ocrStatus: match ? match.status : '-'
        };
      });
      
      setTop5Results(enrichedData);
      
      // scroll to top 5
      setTimeout(() => {
        document.getElementById('top5-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
      
    } catch (err: any) {
      setTop5Error(err.message || 'An error occurred during scanning.');
    } finally {
      setIsScanningTop5(false);
    }
  };

  const handleScanCustom = async () => {
    if (!customText.trim()) return;
    
    setTop5Error('');
    setTop5Results([]);
    setIsScanningTop5(true);
    
    try {
      const tokens = customText.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
      
      // Cuba cari kod bursa (biasanya bermula dengan 4 digit)
      let rawStocks = tokens.filter(t => /^\d{4}/.test(t));
      
      // Jika tiada kod dijumpai (contoh: user paste nama sahaja seperti "MYEG YTL")
      if (rawStocks.length === 0) {
        rawStocks = tokens.filter(t => {
          if (t.length < 2) return false;
          if (t.includes('[') || t.includes(']')) return false;
          if (t.includes('.') || t.includes(',')) return false;
          if (/^\d+$/.test(t)) return false; // Abaikan nombor bulat yang bukan kod bursa
          if (t.startsWith('+') || t.startsWith('-')) return false;
          if (t === 'CALL' || t === 's' || t.toLowerCase() === 'call') return false;
          return true;
        });
      }
      
      // Buang sebarang duplikasi dan hadkan kepada maksimum 100 kaunter untuk elak timeout
      const stocks = [...new Set(rawStocks)].slice(0, 100);
      
      if (stocks.length === 0) {
        throw new Error('Tiada kod saham yang sah ditemui. Sila semak teks anda.');
      }
      
      const response = await fetch('/api/bursa-sniper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stocks })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to scan stocks');
      
      setTop5Results(data.data);
      
      setTimeout(() => {
        document.getElementById('top5-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
      
    } catch (err: any) {
      setTop5Error(err.message || 'An error occurred during scanning.');
    } finally {
      setIsScanningTop5(false);
    }
  };


  const handleLiveScan = async () => {
    setLiveError('');
    setLiveResults([]);
    setLastMasterUpdate(null);
    setIsLiveScanning(true);
    
    try {
      const response = await fetch('/api/bursa-live-screener');
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to scan live market');
      
      setLiveResults(data.data);
    } catch (err: any) {
      setLiveError(err.message || 'An error occurred during live scanning.');
    } finally {
      setIsLiveScanning(false);
    }
  };

  const handleUpdateMaster = async () => {
    setLiveError('');
    setLiveResults([]);
    setIsUpdatingMaster(true);
    
    try {
      const response = await fetch('/api/bursa-live-screener?save=true');
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to update master list');
      
      setLiveResults(data.data);
      setLastMasterUpdate(new Date().toISOString());
    } catch (err: any) {
      setLiveError(err.message || 'An error occurred during update.');
    } finally {
      setIsUpdatingMaster(false);
    }
  };

  const handleSearchStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setLiveError('');
    setSearchedStock(null);
    
    try {
      const response = await fetch(`/api/bursa-search?query=${encodeURIComponent(searchQuery.trim())}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Stock not found');
      }
      
      setSearchedStock(data);
    } catch (err: any) {
      console.error(err);
      setLiveError(err.message || 'Failed to fetch the stock.');
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Hit TP':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'On Going':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: // Belum Gerak
        return 'bg-zinc-800/30 text-zinc-300 border-zinc-700/50';
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveCustomToMaster = async () => {
    if (top5Results.length === 0) return;
    setIsSavingCustom(true);
    try {
      const res = await fetch('/api/bursa-custom-picks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ results: top5Results })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Berjaya simpan ${data.count} kaunter ke dalam Custom Master List!`);
        setCustomMasterResults([]);
      } else {
        alert("Gagal menyimpan ke Custom Master List: " + data.error);
      }
    } catch (e: any) {
      alert("Ralat semasa menyimpan: " + e.message);
    } finally {
      setIsSavingCustom(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pb-20 font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-gradient-to-b from-amber-900/10 via-orange-900/5 to-transparent rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative max-w-5xl mx-auto px-6 pt-24">
        
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Bursa Malaysia Scanner
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            AI Watchlist <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Extractor</span>
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto text-sm md:text-base mb-6">
            Upload or paste an image of a stock watchlist. The AI will intelligently read the stocks, targets, and analyze row colors to determine their status automatically.
          </p>
          <button 
            onClick={() => {
              const newState = !isAiEnabled;
              setIsAiEnabled(newState);
              localStorage.setItem('vibeTraderAiEnabled', String(newState));
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition border ${
              isAiEnabled 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' 
                : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500 hover:text-zinc-400'
            }`}
          >
            <Power className="w-4 h-4" />
            {isAiEnabled ? 'AI Scanner Enabled' : 'AI Scanner Disabled'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800/50 inline-flex backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('ocr')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition ${activeTab === 'ocr' ? 'bg-zinc-800 text-zinc-100 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              OCR Extractor
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition ${activeTab === 'custom' ? 'bg-zinc-800 text-zinc-100 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Custom List
            </button>
            {/* Live Master Tab Hidden */}
            {/* <button
              onClick={() => setActiveTab('live')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 ${activeTab === 'live' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <div className={`w-2 h-2 rounded-full ${activeTab === 'live' ? 'bg-amber-400 animate-pulse' : 'bg-zinc-600'}`} />
              Live Master
            </button> */}
            <button
              onClick={() => setActiveTab('customMaster')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 ${activeTab === 'customMaster' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <div className={`w-2 h-2 rounded-full ${activeTab === 'customMaster' ? 'bg-blue-400 animate-pulse' : 'bg-zinc-600'}`} />
              Custom Master
            </button>
            <button
              onClick={() => setActiveTab('us')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 ${activeTab === 'us' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <div className={`w-2 h-2 rounded-full ${activeTab === 'us' ? 'bg-rose-400 animate-pulse' : 'bg-zinc-600'}`} />
              🇺🇸 US Sniper
            </button>
          </div>
        </div>

        {/* OCR Tab */}
        {activeTab === 'ocr' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Upload Area */}
        <div 
          className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition duration-300 flex flex-col items-center justify-center bg-zinc-900/30 backdrop-blur-sm ${
            isDragging ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="image/*" 
            className="hidden" 
          />
          
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 flex items-center justify-center mb-4 text-zinc-400 shadow-inner">
            <Upload className="w-8 h-8" />
          </div>
          
          <h3 className="text-xl font-bold text-zinc-200 mb-2">Drag & Drop Image Here</h3>
          <p className="text-zinc-500 text-sm mb-6">Or simply press <kbd className="px-2 py-1 bg-zinc-800 rounded text-xs font-mono border border-zinc-700 text-zinc-300">Ctrl+V</kbd> to paste an image</p>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 font-bold rounded-xl transition shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95"
          >
            Browse Files
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="mt-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-start gap-3 backdrop-blur-md">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Extraction Failed</h4>
              <p className="text-sm opacity-80 mt-1">{error}</p>
              <p className="text-xs opacity-60 mt-2">Tip: Make sure you have set the GEMINI_API_KEY in your .env.local file.</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isProcessing && (
          <div className="mt-8 border border-zinc-800 bg-zinc-900/50 p-8 rounded-3xl flex flex-col items-center justify-center backdrop-blur-md relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-zinc-200">Analyzing Image</h3>
            <p className="text-sm text-zinc-500 mt-2 text-center max-w-sm">
              Our Vision AI is extracting the table data and analyzing row colors to determine stock status...
            </p>
          </div>
        )}

        {/* Clear Data Button (Only show if results exist) */}
        {results.length > 0 && !isProcessing && (
           <div className="flex justify-end mt-4 animate-in fade-in">
             <button 
               onClick={() => {
                 setResults([]);
                 setTop5Results([]);
                 localStorage.removeItem('bursaOcrResults');
               }}
               className="text-xs text-zinc-500 hover:text-red-400 transition"
             >
               Clear Saved Data
             </button>
           </div>
        )}

        {/* Results */}
        {results.length > 0 && !isProcessing && (
          <div className="mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Preview Image small */}
            {previewUrl && (
              <div className="flex items-center gap-4 p-4 border border-zinc-800 bg-zinc-900/50 rounded-2xl backdrop-blur-sm">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-amber-500" />
                    Source Image Processed
                  </h4>
                  <p className="text-xs text-zinc-500 mt-1">Successfully extracted {results.length} stocks.</p>
                </div>
              </div>
            )}

            <div className="border border-zinc-800 bg-zinc-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900/80 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                      <th className="p-4 font-semibold pl-6">Stock Name</th>
                      <th className="p-4 font-semibold">Last Done</th>
                      <th className="p-4 font-semibold">Target</th>
                      <th className="p-4 font-semibold">Highest Price</th>
                      <th className="p-4 font-semibold">TP2</th>
                      <th className="p-4 font-semibold pr-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {results.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/30 transition group">
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => copyToClipboard(row.stock_name, idx)}
                              className="text-zinc-600 hover:text-zinc-300 transition opacity-0 group-hover:opacity-100"
                              title="Copy Stock Name"
                            >
                              {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <a 
                              href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${row.stock_name.replace('[S]', '').trim()}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="font-bold text-zinc-200 hover:text-amber-400 hover:underline transition cursor-pointer"
                            >
                              {row.stock_name.replace('[S]', '').trim()}
                            </a>
                            {row.stock_name.includes('[S]') && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                S
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 font-mono text-sm text-zinc-400">{row.last_done || '-'}</td>
                        <td className="p-4 font-mono text-sm text-zinc-300 font-medium">{row.target || '-'}</td>
                        <td className="p-4 font-mono text-sm text-zinc-400">{row.highest_price || '-'}</td>
                        <td className="p-4 font-mono text-sm text-amber-500/80">{row.tp2 || '-'}</td>
                        <td className="p-4 pr-6 text-right">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${getStatusColor(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="flex gap-4 justify-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/30" />
                <span className="text-xs text-zinc-500">Hit TP</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/30" />
                <span className="text-xs text-zinc-500">On Going</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-zinc-800/50 border border-zinc-700/50" />
                <span className="text-xs text-zinc-500">Belum Gerak</span>
              </div>
            </div>

            {/* Top 5 Scanner Button */}
            <div className="flex justify-center mt-12 pb-4">
              <button 
                onClick={handleScanTop5}
                disabled={isScanningTop5}
                className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl text-white font-bold shadow-[0_0_40px_rgba(245,158,11,0.3)] hover:shadow-[0_0_60px_rgba(245,158,11,0.5)] transition duration-300 disabled:opacity-50 active:scale-95"
              >
                {isScanningTop5 ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
                <span className="relative">
                  {isScanningTop5 ? 'Scanning Top 5...' : 'Find Top 5 Sniper Picks'}
                </span>
              </button>
            </div>

            {/* Top 5 Results */}
            {top5Error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-center backdrop-blur-md">
                {top5Error}
              </div>
            )}

            {top5Results.length > 0 && (
              <div id="top5-section" className="mt-8 pt-8 border-t border-zinc-800/50 space-y-6">
                <div className="flex flex-col items-center mb-10">
                  <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                    Top 5 Sniper Candidates
                  </h2>
                  <p className="text-zinc-400 mt-2 mb-6">Berdasarkan momentum teknikal semasa</p>
                  <button
                    onClick={() => setShowSniperDynamic(!showSniperDynamic)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${showSniperDynamic ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}
                  >
                    {showSniperDynamic ? 'Hide Dynamic TP/SL' : 'Show Dynamic TP/SL'}
                  </button>
                </div>
                
                <div className="border border-zinc-800 bg-zinc-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl mt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-900/80 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                          <th className="p-4 font-semibold pl-6">Rank</th>
                          <th className="p-4 font-semibold">Stock</th>
                          <th className="p-4 font-semibold">Score</th>
                          <th className="p-4 font-semibold">Last Done</th>
                          <th className="p-4 font-semibold text-rose-400/80">Stop Loss<br/>{showSniperDynamic && <span className="text-[10px] text-zinc-600">Gann / Dyn</span>}</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP1<br/>{showSniperDynamic && <span className="text-[10px] text-zinc-600">Gann / Dyn</span>}</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP2<br/>{showSniperDynamic && <span className="text-[10px] text-zinc-600">Gann / Dyn</span>}</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP3<br/>{showSniperDynamic && <span className="text-[10px] text-zinc-600">Gann / Dyn</span>}</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP4<br/>{showSniperDynamic && <span className="text-[10px] text-zinc-600">Gann / Dyn</span>}</th>
                          <th className="p-4 font-semibold pr-6">Highest (5D)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {top5Results.map((stock, i) => (
                          <tr key={i} className="hover:bg-zinc-800/30 transition group">
                            <td className="p-4 pl-6">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 font-bold text-xs border border-amber-500/20">
                                #{i + 1}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${stock.symbol.replace('.KL', '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-zinc-200 hover:text-amber-400 hover:underline transition cursor-pointer">{stock.originalName || stock.companyName}</a>
                                  {stock.ocrStatus && stock.ocrStatus !== '-' && (
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getStatusColor(stock.ocrStatus)}`}>
                                      {stock.ocrStatus}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-zinc-500">{stock.symbol}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-amber-400">{stock.score}/10</span>
                            </td>
                            <td className="p-4 font-mono text-sm text-zinc-300">{stock.price}</td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-mono text-sm font-bold text-rose-400">{stock.gannSL || stock.stopLoss}</span>
                                {showSniperDynamic && <span className="text-[10px] text-zinc-500 mt-1">{stock.stopLoss}</span>}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-mono text-sm font-medium text-emerald-400">{stock.gannTP1 || stock.tp1}</span>
                                {showSniperDynamic && <span className="text-[10px] text-zinc-500 mt-1">{stock.tp1}</span>}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-mono text-sm font-medium text-emerald-400">{stock.gannTP2 || stock.tp2}</span>
                                {showSniperDynamic && <span className="text-[10px] text-zinc-500 mt-1">{stock.tp2}</span>}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-mono text-sm font-medium text-emerald-400">{stock.gannTP3 || stock.tp3}</span>
                                {showSniperDynamic && <span className="text-[10px] text-zinc-500 mt-1">{stock.tp3}</span>}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-mono text-sm font-medium text-emerald-400">{stock.gannTP4 || stock.tp4}</span>
                                {showSniperDynamic && <span className="text-[10px] text-zinc-500 mt-1">{stock.tp4}</span>}
                              </div>
                            </td>
                            <td className="p-4 font-mono text-sm text-zinc-400 pr-6">{stock.highest}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
          </div>
        )}

        {/* Custom Tab */}
        {activeTab === 'custom' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="border border-zinc-800 bg-zinc-900/30 rounded-3xl p-8 backdrop-blur-sm mb-8">
              <h2 className="text-xl font-bold text-zinc-200 mb-4">Manual Text Input</h2>
              <p className="text-sm text-zinc-500 mb-6">Paste a list of stock codes or names (e.g. 2429, 4456, YTL). You can separate them by commas, spaces, or newlines.</p>
              
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="e.g. 2429, YTL, 0138, MYEG"
                className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 focus:outline-none focus:border-amber-500/50 resize-none mb-6"
              />
              
              <div className="flex justify-end">
                <button
                  onClick={handleScanCustom}
                  disabled={isScanningTop5 || !customText.trim()}
                  className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white font-bold shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isScanningTop5 ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    'Scan Custom List'
                  )}
                </button>
              </div>
              
              {top5Error && (
                <div className="mt-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center">
                  {top5Error}
                </div>
              )}
            </div>

            {/* Custom Scan Results */}
            {top5Results.length > 0 && (
              <div id="top5-section" className="mt-12">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <span className="text-amber-500 font-bold">★</span>
                  </div>
                  <h2 className="text-2xl font-bold text-zinc-100 flex-1">Sniper Analysis Results</h2>
                  <button
                    onClick={handleSaveCustomToMaster}
                    disabled={isSavingCustom}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${
                      isSavingCustom
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30'
                    }`}
                  >
                    {isSavingCustom ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                    ) : (
                      <>💾 Save to Custom Master</>
                    )}
                  </button>
                </div>
                
                <div className="border border-zinc-800 bg-zinc-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl mt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-900/80 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                          <th className="p-4 font-semibold pl-6">Rank</th>
                          <th className="p-4 font-semibold">Stock</th>
                          <th className="p-4 font-semibold">Score</th>
                          <th className="p-4 font-semibold">Last Done</th>
                          <th className="p-4 font-semibold text-rose-400/80">Stop Loss</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP1</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP2</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP3</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP4</th>
                          <th className="p-4 font-semibold pr-6">Highest (5D)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {top5Results.map((stock, i) => (
                          <tr key={i} className="hover:bg-zinc-800/30 transition group">
                            <td className="p-4 pl-6">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 font-bold text-xs border border-amber-500/20">
                                #{i + 1}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${stock.symbol.replace('.KL', '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-zinc-200 hover:text-amber-400 hover:underline transition cursor-pointer">{stock.companyName || stock.originalName}</a>
                                <span className="text-[10px] text-zinc-500">{stock.symbol}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-amber-400">{stock.score}/10</span>
                            </td>
                            <td className="p-4 font-mono text-sm text-zinc-300">{stock.price}</td>
                            <td className={`p-4 font-mono text-sm font-bold ${stock.gannSLColor === 'red' ? 'text-rose-400' : stock.gannSLColor === 'blue' ? 'text-blue-400' : 'text-zinc-400'}`}>{stock.gannSL}</td>
                            <td className={`p-4 font-mono text-sm font-medium ${stock.gannTP1Color === 'red' ? 'text-rose-400' : stock.gannTP1Color === 'blue' ? 'text-blue-400' : 'text-zinc-400'}`}>{stock.gannTP1}</td>
                            <td className={`p-4 font-mono text-sm font-medium ${stock.gannTP2Color === 'red' ? 'text-rose-400' : stock.gannTP2Color === 'blue' ? 'text-blue-400' : 'text-zinc-400'}`}>{stock.gannTP2}</td>
                            <td className={`p-4 font-mono text-sm font-medium ${stock.gannTP3Color === 'red' ? 'text-rose-400' : stock.gannTP3Color === 'blue' ? 'text-blue-400' : 'text-zinc-400'}`}>{stock.gannTP3}</td>
                            <td className={`p-4 font-mono text-sm font-medium ${stock.gannTP4Color === 'red' ? 'text-rose-400' : stock.gannTP4Color === 'blue' ? 'text-blue-400' : 'text-zinc-400'}`}>{stock.gannTP4}</td>
                            <td className="p-4 font-mono text-sm text-zinc-400 pr-6">{stock.highest}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Screener Tab */}
        {activeTab === 'live' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!liveResults.length && !isLiveScanning && (
              <div className="border border-zinc-800 bg-zinc-900/30 rounded-3xl p-12 text-center backdrop-blur-sm">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
                  <Power className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-200 mb-2">Live Market Screener</h3>
                <p className="text-zinc-500 max-w-md mx-auto mb-8">
                  Scan the top 80+ most active stocks in Bursa Malaysia instantly to find the best technical setups.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mx-auto justify-center">
                  <button 
                    onClick={handleLiveScan}
                    className="group relative inline-flex items-center gap-3 px-8 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-zinc-100 font-bold transition duration-300 active:scale-95"
                  >
                    <span>Dynamic Scan</span>
                  </button>
                  <button 
                    onClick={handleUpdateMaster}
                    className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl text-white font-bold shadow-[0_0_40px_rgba(245,158,11,0.3)] hover:shadow-[0_0_60px_rgba(245,158,11,0.5)] transition duration-300 active:scale-95"
                  >
                    <span className="relative">Update Master List</span>
                  </button>
                </div>
              </div>
            )}

            {(isLiveScanning || isUpdatingMaster) && (
              <div className="border border-zinc-800 bg-zinc-900/50 p-12 rounded-3xl flex flex-col items-center justify-center backdrop-blur-md relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-6" />
                <h3 className="text-xl font-bold text-zinc-200">
                  {isUpdatingMaster ? 'Updating Master List' : 'Scanning Live Market'}
                </h3>
                <p className="text-sm text-zinc-500 mt-2 text-center max-w-sm">
                  Connecting to Bursa Malaysia to analyze active stocks...
                </p>
              </div>
            )}
            
            {liveError && (
              <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-center backdrop-blur-md">
                {liveError}
              </div>
            )}
            
            {(liveResults.length > 0 || searchedStock) && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-100">Top 30 Live Picks</h2>
                    <p className="text-zinc-500 text-xs mt-1">
                      {lastMasterUpdate 
                        ? `Master List loaded from D1 (Last saved: ${new Date(lastMasterUpdate).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })})` 
                        : 'Market scanned successfully.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <form onSubmit={handleSearchStock} className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Search stock..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 w-36"
                      />
                      <button 
                        type="submit"
                        disabled={isSearching || isLiveScanning}
                        className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/20 rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center justify-center min-w-[70px]"
                      >
                        {isSearching ? <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"/> : 'Search'}
                      </button>
                    </form>
                    
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/50 border border-zinc-800 mx-1">
                      <span className="text-xs font-medium text-zinc-400 select-none">Dynamic</span>
                      <button 
                        onClick={() => setShowDynamic(!showDynamic)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${showDynamic ? 'bg-amber-500' : 'bg-zinc-700'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showDynamic ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <button 
                      onClick={handleLiveScan}
                      disabled={isLiveScanning || isUpdatingMaster}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-bold transition disabled:opacity-50"
                    >
                      Dynamic Scan
                    </button>
                    <button 
                      onClick={handleUpdateMaster}
                      disabled={isLiveScanning || isUpdatingMaster}
                      className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 border border-amber-500/20 rounded-xl text-sm font-bold transition disabled:opacity-50"
                    >
                      Update Master List
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-xl transition"
                      title="Refresh Page"
                    >
                      <RefreshCcw className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="border border-zinc-800 bg-zinc-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-900/80 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                          <th className="p-4 font-semibold pl-6">Rank</th>
                          <th className="p-4 font-semibold">Stock</th>
                          <th className="p-4 font-semibold">Score</th>
                          <th className="p-4 font-semibold">Last Done</th>
                          <th className="p-4 font-semibold text-rose-400/80">Stop Loss<br/>{showDynamic && <span className="text-[10px] text-zinc-600">Stat / Dyn</span>}</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP1<br/>{showDynamic && <span className="text-[10px] text-zinc-600">Stat / Dyn</span>}</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP2<br/>{showDynamic && <span className="text-[10px] text-zinc-600">Stat / Dyn</span>}</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP3<br/>{showDynamic && <span className="text-[10px] text-zinc-600">Stat / Dyn</span>}</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP4<br/>{showDynamic && <span className="text-[10px] text-zinc-600">Stat / Dyn</span>}</th>
                          <th className="p-4 font-semibold pr-6">Highest (5D)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {searchedStock && (
                          <tr className="hover:bg-blue-900/10 transition group border-b-2 border-blue-500/30 relative">
                            <td className="p-4 pl-6 relative">
                              <div className="absolute inset-y-0 left-0 w-1 bg-blue-500"></div>
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs border border-blue-500/30">
                                🔍
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${searchedStock.symbol.replace('.KL', '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-300 hover:text-blue-400 hover:underline transition cursor-pointer">{searchedStock.companyName}</a>
                                <span className="text-[10px] text-blue-500/70">{searchedStock.symbol}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-amber-400">{searchedStock.score}/10</span>
                            </td>
                            <td className="p-4 font-mono text-sm text-zinc-300">{searchedStock.price}</td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticSLColor === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className="font-mono text-sm font-bold text-rose-400">{searchedStock.staticSL}</span>
                                </div>
                                {showDynamic && <span className="font-mono text-xs font-medium text-rose-500/50 pl-3">{searchedStock.stopLoss}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticTP1Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.staticTP1) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{searchedStock.staticTP1}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.tp1) || searchedStock.hitTp1 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{searchedStock.tp1}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticTP2Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.staticTP2) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{searchedStock.staticTP2}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.tp2) || searchedStock.hitTp2 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{searchedStock.tp2}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticTP3Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.staticTP3) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{searchedStock.staticTP3}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.tp3) || searchedStock.hitTp3 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{searchedStock.tp3}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticTP4Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.staticTP4) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{searchedStock.staticTP4}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.tp4) || searchedStock.hitTp4 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{searchedStock.tp4}</span>}
                              </div>
                            </td>
                            <td className="p-4 font-mono text-sm text-zinc-500 pr-6">{searchedStock.highestPrice}</td>
                          </tr>
                        )}
                        {liveResults.map((row, idx) => (
                          <tr key={idx} className="hover:bg-zinc-900/30 transition group">
                            <td className="p-4 pl-6">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 font-bold text-xs border border-amber-500/20">
                                #{idx + 1}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${row.symbol.replace('.KL', '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-zinc-200 hover:text-zinc-100 hover:underline transition cursor-pointer">{row.companyName}</a>
                                <span className="text-[10px] text-zinc-500">{row.symbol}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-amber-400">{row.score}/10</span>
                            </td>
                            <td className="p-4 font-mono text-sm text-zinc-300">{row.price}</td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${row.staticSLColor === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className="font-mono text-sm font-bold text-rose-400">{row.staticSL}</span>
                                </div>
                                {showDynamic && <span className="font-mono text-xs font-medium text-rose-500/50 pl-3">{row.stopLoss}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP1Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP1) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{row.staticTP1}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp1) || row.hitTp1 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{row.tp1}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP2Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP2) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{row.staticTP2}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp2) || row.hitTp2 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{row.tp2}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP3Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP3) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{row.staticTP3}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp3) || row.hitTp3 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{row.tp3}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP4Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP4) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{row.staticTP4}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp4) || row.hitTp4 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{row.tp4}</span>}
                              </div>
                            </td>
                            <td className="p-4 font-mono text-sm text-zinc-500 pr-6">{row.highestPrice}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Custom Master Tab */}
        {activeTab === 'customMaster' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!customMasterResults.length && !isFetchingCustomMaster && (
              <div className="border border-zinc-800 bg-zinc-900/30 rounded-3xl p-12 text-center backdrop-blur-sm">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
                  <Power className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-200 mb-2">Custom Master List</h3>
                <p className="text-zinc-500 max-w-md mx-auto mb-8">
                  Tiada senarai tersimpan. Sila pergi ke tab "Custom List", buat carian, dan tekan "Save to Custom Master".
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mx-auto justify-center">
                  <button 
                    onClick={() => {
                      setCustomMasterResults([]);
                      setIsFetchingCustomMaster(true);
                      fetch('/api/bursa-custom-picks')
                        .then(res => res.json())
                        .then(data => {
                          if (data.success && data.data) {
                            setCustomMasterResults(data.data);
                            setLastCustomMasterUpdate(new Date().toISOString());
                          }
                        })
                        .finally(() => setIsFetchingCustomMaster(false));
                    }}
                    className="group relative inline-flex items-center gap-3 px-8 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-zinc-100 font-bold transition duration-300 active:scale-95"
                  >
                    <span>Muat Semula senarai tersimpan</span>
                  </button>
                </div>
              </div>
            )}

            {isFetchingCustomMaster && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                <p className="text-zinc-400 font-medium">Fetching custom master list...</p>
              </div>
            )}

            {customMasterResults.length > 0 && !isFetchingCustomMaster && (
              <div className="mt-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <span className="text-blue-500 font-bold">★</span>
                      </div>
                      <h2 className="text-2xl font-bold text-zinc-100">Custom Master List</h2>
                    </div>
                    {lastCustomMasterUpdate && (
                      <p className="text-sm text-zinc-500 mt-2 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Live updates from Yahoo Finance
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 items-center">
                    <form onSubmit={handleSearchStock} className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Search stock..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 w-36"
                      />
                      <button 
                        type="submit"
                        disabled={isSearching}
                        className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/20 rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center justify-center min-w-[70px]"
                      >
                        {isSearching ? <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"/> : 'Search'}
                      </button>
                    </form>
                    <button
                      onClick={() => setShowDynamic(!showDynamic)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${showDynamic ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}
                    >
                      {showDynamic ? 'Show Static Gann' : 'Show Dynamic TP/SL'}
                    </button>
                    <button
                      onClick={() => {
                        setCustomMasterResults([]);
                        setIsFetchingCustomMaster(true);
                        fetch('/api/bursa-custom-picks')
                          .then(res => res.json())
                          .then(data => {
                            if (data.success && data.data) {
                              setCustomMasterResults(data.data);
                              setLastCustomMasterUpdate(new Date().toISOString());
                            }
                          })
                          .finally(() => setIsFetchingCustomMaster(false));
                      }}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition flex items-center gap-2"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" /> Refresh
                    </button>
                  </div>
                </div>

                <div className="border border-zinc-800 bg-zinc-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-900/80 border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
                          <th className="p-4 font-semibold w-16 pl-6">Rank</th>
                          <th className="p-4 font-semibold w-48">Stock</th>
                          <th className="p-4 font-semibold w-24">Score</th>
                          <th className="p-4 font-semibold w-32">
                            <div className="flex flex-col">
                              <span>Last Done</span>
                              <span className="text-[10px] text-zinc-500 font-normal capitalize">
                                {searchedStock?.lastDoneDate || (customMasterResults.length > 0 ? customMasterResults[0].lastDoneDate : '') || '(Date)'}
                              </span>
                            </div>
                          </th>
                          <th className="p-4 font-semibold text-rose-400/80 w-32">Stop Loss</th>
                          <th className="p-4 font-semibold text-emerald-400/80 w-32">TP1</th>
                          <th className="p-4 font-semibold text-emerald-400/80 w-32">TP2</th>
                          <th className="p-4 font-semibold text-emerald-400/80 w-32">TP3</th>
                          <th className="p-4 font-semibold text-emerald-400/80 w-32">TP4</th>
                          <th className="p-4 font-semibold pr-6 w-32">Highest (This Week)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {searchedStock && (
                          <tr className="hover:bg-blue-900/10 transition group border-b-2 border-blue-500/30 relative">
                            <td className="p-4 pl-6 relative">
                              <div className="absolute inset-y-0 left-0 w-1 bg-blue-500"></div>
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs border border-blue-500/30">
                                🔍
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${searchedStock.symbol.replace('.KL', '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-300 hover:text-blue-400 hover:underline transition cursor-pointer">{searchedStock.companyName}</a>
                                <span className="text-[10px] text-blue-500/70">{searchedStock.symbol}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-amber-400">{searchedStock.score}/10</span>
                            </td>
                            <td className="p-4 font-mono text-sm text-zinc-300">
                              {searchedStock.price}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticSLColor === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className="font-mono text-sm font-bold text-rose-400">{searchedStock.staticSL}</span>
                                </div>
                                {showDynamic && <span className="font-mono text-xs font-medium text-rose-500/50 pl-3">{searchedStock.stopLoss}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticTP1Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.staticTP1) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{searchedStock.staticTP1}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.tp1) || searchedStock.hitTp1 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{searchedStock.tp1}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticTP2Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.staticTP2) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{searchedStock.staticTP2}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.tp2) || searchedStock.hitTp2 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{searchedStock.tp2}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticTP3Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.staticTP3) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{searchedStock.staticTP3}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.tp3) || searchedStock.hitTp3 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{searchedStock.tp3}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticTP4Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.staticTP4) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{searchedStock.staticTP4}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.tp4) || searchedStock.hitTp4 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{searchedStock.tp4}</span>}
                              </div>
                            </td>
                            <td className="p-4 font-mono text-sm text-zinc-500 pr-6">{searchedStock.highestPrice}</td>
                          </tr>
                        )}
                        {customMasterResults.map((row, idx) => (
                          <tr key={idx} className="hover:bg-zinc-800/30 transition group">
                            <td className="p-4 pl-6">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 font-bold text-xs border border-blue-500/20">
                                #{idx + 1}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${row.symbol.replace('.KL', '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-zinc-200 hover:text-blue-400 hover:underline transition cursor-pointer">{row.companyName}</a>
                                <span className="text-[10px] text-zinc-500 font-mono">{row.symbol}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-blue-400">{row.score}/10</span>
                            </td>
                            <td className="p-4 font-mono text-sm text-zinc-300">
                              {row.price}
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${row.staticSLColor === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.price) <= parseFloat(row.staticSL) ? 'bg-rose-500/20 text-rose-400 px-1 rounded animate-pulse' : 'text-rose-400'}`}>{row.staticSL}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.price) <= parseFloat(row.stopLoss) ? 'text-rose-500' : 'text-rose-400/50'}`}>{row.stopLoss}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP1Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP1) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{row.staticTP1}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp1) || row.hitTp1 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{row.tp1}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP2Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP2) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{row.staticTP2}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp2) || row.hitTp2 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{row.tp2}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP3Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP3) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{row.staticTP3}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp3) || row.hitTp3 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{row.tp3}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP4Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP4) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{row.staticTP4}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp4) || row.hitTp4 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>{row.tp4}</span>}
                              </div>
                            </td>
                            <td className="p-4 font-mono text-sm text-zinc-500 pr-6">{row.highestPrice}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* US Sniper Tab */}
        {activeTab === 'us' && (
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
                        <th className="p-4 font-semibold w-32">Last Done</th>
                        <th className="p-4 font-semibold text-rose-400/80 w-32">Stop Loss</th>
                        <th className="p-4 font-semibold text-emerald-400/80 w-32">TP1</th>
                        <th className="p-4 font-semibold text-emerald-400/80 w-32">TP2</th>
                        <th className="p-4 font-semibold text-emerald-400/80 w-32">TP3</th>
                        <th className="p-4 font-semibold pr-6 w-32">Highest (5D)</th>
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
                          <td className="p-4 font-mono text-sm text-zinc-300">
                            <div className="flex items-center gap-2">
                              ${parseFloat(row.price).toFixed(2)}
                            </div>
                          </td>
                          <td className={`p-4`}>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${row.staticSLColor === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                <span className={`font-mono text-sm font-medium ${parseFloat(row.price) <= parseFloat(row.staticSL) ? 'bg-rose-500/20 text-rose-400 px-1 rounded animate-pulse' : 'text-rose-400'}`}>${row.staticSL}</span>
                              </div>
                              {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.price) <= parseFloat(row.stopLoss) ? 'text-rose-500' : 'text-rose-400/50'}`}>${row.stopLoss}</span>}
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
                          <td className={`p-4`}>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP3Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP3) ? 'bg-zinc-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>${row.staticTP3}</span>
                              </div>
                              {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp3) || row.hitTp3 ? 'text-zinc-600' : 'text-emerald-500/50'}`}>${row.tp3}</span>}
                            </div>
                          </td>
                          <td className="p-4 font-mono text-sm text-zinc-500 pr-6">${row.highestPrice}</td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {usSniperView === 'scanner' ? (
                                <>
                                  <button onClick={() => saveToUsWatchlist(row)} disabled={isSavingUsWatchlist} className="text-zinc-600 hover:text-emerald-500 transition-colors bg-zinc-800/50 hover:bg-emerald-500/10 p-2 rounded-lg disabled:opacity-50">
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
    </main>
  );
}
