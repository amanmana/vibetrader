"use client";

import { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Loader2, AlertCircle, Copy, Check, Power, RefreshCcw, Trash2, Save, TrendingUp, TrendingDown, Trophy, X } from 'lucide-react';

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
  
  const [activeTab, setActiveTab] = useState<'ocr' | 'live' | 'custom' | 'customMaster' | 'us' | 'topActive'>('customMaster');
  const [customText, setCustomText] = useState('');
  const [isLiveScanning, setIsLiveScanning] = useState(false);

  // iSaham Top Active states
  const [selectedScreener, setSelectedScreener] = useState<'top-active' | 'jerung-x' | 'isaham-super-short-term'>('top-active');
  const [topActiveResults, setTopActiveResults] = useState<any[]>([]);
  const [isFetchingTopActive, setIsFetchingTopActive] = useState(false);
  const [topActiveError, setTopActiveError] = useState('');
  const [isahamCookie, setIsahamCookie] = useState('');
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [hasUnlockedScores, setHasUnlockedScores] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isSavingPaste, setIsSavingPaste] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [lastScreenerUpdate, setLastScreenerUpdate] = useState<string | null>(null);


  // Load customText from localStorage, and isaham_cookie from D1 on mount
  useEffect(() => {
    const saved = localStorage.getItem('bursa_custom_text');
    if (saved) {
      setCustomText(saved);
    }
    
    async function loadDatabaseSettings() {
      try {
        const res = await fetch('/api/system-settings?key=isaham_cookie');
        const data = await res.json();
        if (data.success && data.value) {
          setIsahamCookie(data.value);
        }
      } catch (e) {
        console.error('Failed to load isaham cookie from database:', e);
      }
    }
    loadDatabaseSettings();
  }, []);

  const fetchTopActive = async (screenerName = selectedScreener) => {
    setIsFetchingTopActive(true);
    setTopActiveError('');
    setIsFallback(false);
    try {
      const res = await fetch(`/api/bursa-top-active?screener=${screenerName}`);
      const data = await res.json();
      if (data.success && data.results) {
        setTopActiveResults(data.results);
        setHasUnlockedScores(data.hasUnlockedScores || false);
        setIsFallback(data.isFallback || false);
        setLastScreenerUpdate(data.updatedAt || null);
      } else {
        setTopActiveError(data.error || 'Gagal memuatkan data.');
      }
    } catch (err: any) {
      console.error(err);
      setTopActiveError(err.message || 'Ralat sambungan.');
    } finally {
      setIsFetchingTopActive(false);
    }
  };


  const handleScreenerChange = (val: 'top-active' | 'jerung-x' | 'isaham-super-short-term') => {
    setSelectedScreener(val);
    fetchTopActive(val);
  };

  const handleSavePastedData = async () => {
    if (!pasteText.trim()) return;
    setIsSavingPaste(true);
    try {
      let cleanedList = [];
      let rawText = pasteText.trim();
      
      // 1. Try parsing JSON
      if (rawText.startsWith('{') || rawText.startsWith('[')) {
        try {
          const parsed = JSON.parse(rawText);
          const rawList = Array.isArray(parsed) ? parsed : (parsed.data || parsed.results || []);
          cleanedList = rawList.map((item: any, idx: number) => {
            let symbol = '';
            let name = '';
            let rank = idx + 1;
            let price = 0;
            let change = 0;
            let volume = 0;
            let marketCap = 0;
            let isahamScore = 0;
            let ltsScore = 0;

            if (item.s_symbol) {
              const symbolMatch = item.s_symbol.match(/<div><div>([A-Z0-9&._-]+)<\/div>/i);
              symbol = symbolMatch ? symbolMatch[1].toUpperCase() : '';
              const nameMatch = item.s_symbol.match(/<small[^>]*>([^<]+)<\/small>/);
              name = nameMatch ? nameMatch[1].trim() : '';
            } else {
              symbol = item.symbol || item.ticker || '';
              name = item.name || item.companyName || symbol;
            }

            if (item.sort_order) {
              const rankMatch = item.sort_order.match(/>(\d+)</);
              rank = rankMatch ? parseInt(rankMatch[1], 10) : rank;
            } else {
              rank = item.rank || rank;
            }

            price = parseFloat(item.lp1 || item.price || item.last_price) || 0;
            change = parseFloat(item.perf_1d || item.change || item.change_percent) || 0;
            volume = parseInt(item.volume, 10) || 0;
            marketCap = parseInt(item.market_cap || item.marketCap, 10) || 0;
            isahamScore = parseFloat(item.total_score || item.isahamScore) || 0;
            ltsScore = parseFloat(item.lts_score || item.ltsScore) || 0;

            return { rank, symbol, name, price, change, volume, marketCap, isahamScore, ltsScore };
          }).filter((item: any) => item.symbol);
        } catch (e) {
          console.warn("Failed parsing paste as JSON:", e);
        }
      }

      // 2. Try parsing plain text if JSON parsing yielded nothing
      if (cleanedList.length === 0) {
        const lines = rawText.split('\n');
        let rankCounter = 1;

        for (const line of lines) {
          if (!line.trim()) continue;
          
          let parts = line.split('\t').map(p => p.trim()).filter(Boolean);
          if (parts.length < 3) {
            parts = line.split(/ {2,}/).map(p => p.trim()).filter(Boolean);
          }
          if (parts.length < 3) continue;

          // Skip headers
          if (line.toLowerCase().includes('stock') || line.toLowerCase().includes('price') || line.toLowerCase().includes('volume')) {
            continue;
          }

          let rank = rankCounter++;
          let symbol = '';
          let name = '';
          let price = 0;
          let change = 0;
          let volume = 0;
          let marketCap = 0;
          let ltsScore = 0;
          let isahamScore = 0;

          let priceIdx = -1;
          let changeIdx = -1;

          // Find price and change
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part.includes('%')) {
              changeIdx = i;
            } else if (priceIdx === -1 && /^\d+\.\d+$/.test(part.replace(/RM\s*/i, ''))) {
              priceIdx = i;
            }
          }

          if (priceIdx !== -1) {
            price = parseFloat(parts[priceIdx].replace(/[^\d.]/g, '')) || 0;
            let beforePrice = parts.slice(0, priceIdx);
            
            if (/^\d+$/.test(beforePrice[0])) {
              rank = parseInt(beforePrice[0], 10);
              beforePrice.shift();
            }

            if (beforePrice.length > 0) {
              if (/^\d{4}$/.test(beforePrice[0])) {
                symbol = beforePrice[0];
                name = beforePrice[1] || beforePrice[0];
              } else {
                symbol = beforePrice[0];
                name = beforePrice.join(' ');
              }
            } else {
              symbol = parts[0];
              name = parts[0];
            }

            if (changeIdx !== -1) {
              change = parseFloat(parts[changeIdx].replace(/[%+]/g, '')) || 0;
            }

            const afterChange = parts.slice(Math.max(priceIdx, changeIdx) + 1);
            if (afterChange.length > 0) {
              volume = parseInt(afterChange[0].replace(/,/g, ''), 10) || 0;
            }
            if (afterChange.length > 1) {
              marketCap = parseInt(afterChange[1].replace(/,/g, ''), 10) || 0;
            }
            if (afterChange.length > 2) {
              ltsScore = parseFloat(afterChange[2]) || 0;
            }
            if (afterChange.length > 3) {
              isahamScore = parseFloat(afterChange[3]) || 0;
            }

            if (symbol) {
              cleanedList.push({ rank, symbol, name, price, change, volume, marketCap, ltsScore, isahamScore });
            }
          }
        }
      }

      if (cleanedList.length === 0) {
        alert("Gagal mengesan data saham. Sila pastikan format yang disalin adalah betul.");
        setIsSavingPaste(false);
        return;
      }

      // Save to D1
      const res = await fetch('/api/bursa-top-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screener: selectedScreener, results: cleanedList })
      });
      const data = await res.json();
      if (data.success) {
        setPasteText('');
        setShowPasteModal(false);
        fetchTopActive(selectedScreener);
      } else {
        alert("Gagal menyimpan ke database: " + data.error);
      }
    } catch (e: any) {
      alert("Ralat: " + e.message);
    } finally {
      setIsSavingPaste(false);
    }
  };


  const [isUpdatingMaster, setIsUpdatingMaster] = useState(false);
  const [liveResults, setLiveResults] = useState<any[]>([]);
  const [liveError, setLiveError] = useState('');
  const [lastMasterUpdate, setLastMasterUpdate] = useState<string | null>(null);

  const [customMasterResults, setCustomMasterResults] = useState<any[]>([]);
  const [lastCustomMasterUpdate, setLastCustomMasterUpdate] = useState<string | null>(null);
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  const [isFetchingCustomMaster, setIsFetchingCustomMaster] = useState(false);
  const [labelPickerOpen, setLabelPickerOpen] = useState<string | null>(null); // symbol of row with open picker
  const [savingLabel, setSavingLabel] = useState<string | null>(null);

  const LABEL_COLORS = [
    { id: 'red', bg: '#ef4444', label: 'Merah' },
    { id: 'green', bg: '#22c55e', label: 'Hijau' },
    { id: 'orange', bg: '#f97316', label: 'Oren' },
    { id: 'yellow', bg: '#eab308', label: 'Kuning' },
    { id: 'blue', bg: '#3b82f6', label: 'Biru' },
    { id: 'purple', bg: '#a855f7', label: 'Ungu' },
  ];

  const [showDynamic, setShowDynamic] = useState(false);
  const [showSniperDynamic, setShowSniperDynamic] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchedStock, setSearchedStock] = useState<any | null>(null);

  const [customTopPicks, setCustomTopPicks] = useState<any[]>([]);
  const [ignoredCustomPicks, setIgnoredCustomPicks] = useState<string[]>([]);
  
  const loadCustomMasterPicks = async (force = false) => {
    if (!force && customMasterResults.length > 0) return;
    setIsFetchingCustomMaster(true);
    try {
      const res = await fetch('/api/bursa-custom-picks');
      const data = await res.json();
      if (data.success && data.data) {
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
  };

  const addToCustomText = async (symbol: string, companyName?: string, isManual: boolean = false) => {
    const cleanSym = symbol.replace('.KL', '').replace('MYX:', '');
    try {
      setAddingSymbol(cleanSym);
      const res = await fetch('/api/bursa-custom-picks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'add', symbol: cleanSym, name: companyName, isManual })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Berjaya menambah kaunter "${data.symbol || cleanSym}" (${data.companyName || ''}) ke dalam Custom Master List!`);
        
        // Switch tab to customMaster and force reload
        setActiveTab('customMaster');
        setCustomMasterResults([]);
        await loadCustomMasterPicks(true);
      } else {
        alert(data.error || 'Gagal menambah kaunter.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Ralat sambungan: ' + err.message);
    } finally {
      setAddingSymbol(null);
    }
  };

  const deleteFromCustom = async (symbol: string, companyName?: string) => {
    if (!confirm(`Adakah anda pasti untuk memadam kaunter "${symbol}" (${companyName || ''}) daripada Custom Master List?`)) {
      return;
    }
    try {
      const res = await fetch('/api/bursa-custom-picks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'delete', symbol: symbol })
      });
      const data = await res.json();
      if (data.success) {
        setCustomMasterResults([]);
        await loadCustomMasterPicks(true);
      } else {
        alert(data.error || 'Gagal memadam kaunter.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Ralat sambungan: ' + err.message);
    }
  };

  const setStockLabelColor = async (symbol: string, color: string | null) => {
    setSavingLabel(symbol);
    // Optimistic update — immediately reflect in UI without waiting for API
    setCustomMasterResults((prev: any[]) =>
      prev.map((r: any) => r.symbol === symbol ? { ...r, labelColor: color } : r)
    );
    setLabelPickerOpen(null);
    try {
      await fetch('/api/bursa-custom-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'label', symbol, color }),
      });
    } catch (err) {
      console.error('Failed to save label:', err);
    } finally {
      setSavingLabel(null);
    }
  };

  const findCustomTopPicks = (ignoredList: string[] = ignoredCustomPicks) => {
    if (!customMasterResults || customMasterResults.length === 0) return;
    
    // Filter for picks with good potential
    const filtered = customMasterResults.filter(res => {
      if (ignoredList.includes(res.symbol)) return false;
      
      const curPrice = parseFloat(res.currentPrice || res.price);
      const sl = parseFloat(res.staticSL);
      const tp1 = parseFloat(res.staticTP1);
      
      // Basic criteria: Not hit stop loss, not hit TP1 yet
      if (curPrice <= sl) return false;
      if (curPrice >= tp1) return false;
      if (res.hitTp1 || res.hitTp2) return false;
      
      return true;
    });

    // Sort descending by score
    const sorted = filtered.sort((a, b) => {
      const scoreA = parseFloat(a.score?.split('/')[0] || 0);
      const scoreB = parseFloat(b.score?.split('/')[0] || 0);
      return scoreB - scoreA; // descending
    });

    // Get top 3
    setCustomTopPicks(sorted.slice(0, 3));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getWeeklyTradePeriod = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToLastFriday = dayOfWeek >= 5 ? dayOfWeek - 5 : dayOfWeek + 2;
    const lastFriday = new Date(today);
    lastFriday.setDate(today.getDate() - diffToLastFriday);
    
    const upcomingFriday = new Date(lastFriday);
    upcomingFriday.setDate(lastFriday.getDate() + 7);
    
    const formatShortDate = (date: Date) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${date.getDate()} ${months[date.getMonth()]}`;
    };
    
    return `${formatShortDate(lastFriday)} - ${formatShortDate(upcomingFriday)}`;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load state from local storage and D1 on mount
  useEffect(() => {
    const savedState = localStorage.getItem('vibeTraderAiEnabled');
    if (savedState !== null) {
      setIsAiEnabled(savedState === 'true');
    }
    
    async function loadOcrResults() {
      try {
        const res = await fetch('/api/bursa-ocr-picks');
        const data = await res.json();
        if (data.success && data.data) {
          setResults(data.data);
        }
      } catch (e) {
        console.error("Failed to fetch OCR picks from D1:", e);
      }
    }
    loadOcrResults();
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
    if (activeTab === 'customMaster') {
      loadCustomMasterPicks();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Fetch iSaham Top Active picks on tab change
  useEffect(() => {
    if (activeTab === 'topActive' && topActiveResults.length === 0) {
      fetchTopActive();
    }
  }, [activeTab]);

  // Close label picker when clicking outside
  useEffect(() => {
    if (!labelPickerOpen) return;
    const handler = () => setLabelPickerOpen(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [labelPickerOpen]);


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
        
        // Save to D1 database in the background
        fetch('/api/bursa-ocr-picks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results: data.data })
        }).catch(err => console.error("Failed to save OCR picks to D1:", err));
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
        return 'bg-slate-800/30 text-slate-300 border-slate-700/50';
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
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans">
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
          <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base mb-6">
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
                : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-400'
            }`}
          >
            <Power className="w-4 h-4" />
            {isAiEnabled ? 'AI Scanner Enabled' : 'AI Scanner Disabled'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-slate-900/50 p-1 rounded-2xl border border-slate-800/50 inline-flex backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('ocr')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition ${activeTab === 'ocr' ? 'bg-slate-800 text-slate-100 shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
            >
              OCR Extractor
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition ${activeTab === 'custom' ? 'bg-slate-800 text-slate-100 shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Custom List
            </button>
            {/* Live Master Tab Hidden */}
            {/* <button
              onClick={() => setActiveTab('live')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 ${activeTab === 'live' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <div className={`w-2 h-2 rounded-full ${activeTab === 'live' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
              Live Master
            </button> */}
            <button
              onClick={() => setActiveTab('customMaster')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 ${activeTab === 'customMaster' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <div className={`w-2 h-2 rounded-full ${activeTab === 'customMaster' ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
              Custom Master
            </button>
            <button
              onClick={() => setActiveTab('topActive')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 ${activeTab === 'topActive' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <div className={`w-2 h-2 rounded-full ${activeTab === 'topActive' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              iSaham Screener
            </button>

          </div>
        </div>

        {/* OCR Tab */}
        {activeTab === 'ocr' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Upload Area */}
        <div 
          className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition duration-300 flex flex-col items-center justify-center bg-slate-900/30 backdrop-blur-sm ${
            isDragging ? 'border-amber-500 bg-amber-500/5' : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/30'
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
          
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-4 text-slate-400 shadow-inner">
            <Upload className="w-8 h-8" />
          </div>
          
          <h3 className="text-xl font-bold text-slate-200 mb-2">Drag & Drop Image Here</h3>
          <p className="text-slate-500 text-sm mb-6">Or simply press <kbd className="px-2 py-1 bg-slate-800 rounded text-xs font-mono border border-slate-700 text-slate-300">Ctrl+V</kbd> to paste an image</p>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 bg-slate-100 hover:bg-white text-slate-900 font-bold rounded-xl transition shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95"
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
          <div className="mt-8 border border-slate-800 bg-slate-900/50 p-8 rounded-3xl flex flex-col items-center justify-center backdrop-blur-md relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
            <h3 className="text-lg font-bold text-slate-200">Analyzing Image</h3>
            <p className="text-sm text-slate-500 mt-2 text-center max-w-sm">
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
                 
                 // Clear from D1 database in the background
                 fetch('/api/bursa-ocr-picks', {
                   method: 'DELETE'
                 }).catch(err => console.error("Failed to clear OCR picks in D1:", err));
               }}
               className="text-xs text-slate-500 hover:text-red-400 transition"
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
              <div className="flex items-center gap-4 p-4 border border-slate-800 bg-slate-900/50 rounded-2xl backdrop-blur-sm">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-amber-500" />
                    Source Image Processed
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">Successfully extracted {results.length} stocks.</p>
                </div>
              </div>
            )}

            <div className="border border-slate-800 bg-slate-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                      <th className="p-4 font-semibold pl-6">Stock Name</th>
                      <th className="p-4 font-semibold">Last Done</th>
                      <th className="p-4 font-semibold">Target</th>
                      <th className="p-4 font-semibold">Highest Price</th>
                      <th className="p-4 font-semibold">TP2</th>
                      <th className="p-4 font-semibold pr-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {results.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/30 transition group">
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => copyToClipboard(row.stock_name, idx)}
                              className="text-slate-600 hover:text-slate-300 transition opacity-0 group-hover:opacity-100"
                              title="Copy Stock Name"
                            >
                              {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <a 
                              href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${row.stock_name.replace('[S]', '').trim()}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="font-bold text-slate-200 hover:text-amber-400 hover:underline transition cursor-pointer"
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
                        <td className="p-4 font-mono text-sm text-slate-400">{row.last_done || '-'}</td>
                        <td className="p-4 font-mono text-sm text-slate-300 font-medium">{row.target || '-'}</td>
                        <td className="p-4 font-mono text-sm text-slate-400">{row.highest_price || '-'}</td>
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
                <span className="text-xs text-slate-500">Hit TP</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/30" />
                <span className="text-xs text-slate-500">On Going</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-slate-800/50 border border-slate-700/50" />
                <span className="text-xs text-slate-500">Belum Gerak</span>
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
              <div id="top5-section" className="mt-8 pt-8 border-t border-slate-800/50 space-y-6">
                <div className="flex flex-col items-center mb-10">
                  <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                    Top 5 Sniper Candidates
                  </h2>
                  <p className="text-slate-400 mt-2 mb-6">Berdasarkan momentum teknikal semasa</p>
                  <button
                    onClick={() => setShowSniperDynamic(!showSniperDynamic)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${showSniperDynamic ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
                  >
                    {showSniperDynamic ? 'Hide Dynamic TP/SL' : 'Show Dynamic TP/SL'}
                  </button>
                </div>
                
                <div className="border border-slate-800 bg-slate-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl mt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                          <th className="p-4 font-semibold pl-6">Rank</th>
                          <th className="p-4 font-semibold">Stock</th>
                          <th className="p-4 font-semibold">Score</th>
                          <th className="p-4 font-semibold">Last Done</th>
                          <th className="p-4 font-semibold text-rose-400/80">Stop Loss<br/>{showSniperDynamic && <span className="text-[10px] text-slate-600">Gann / Dyn</span>}</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP1<br/>{showSniperDynamic && <span className="text-[10px] text-slate-600">Gann / Dyn</span>}</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP2<br/>{showSniperDynamic && <span className="text-[10px] text-slate-600">Gann / Dyn</span>}</th>
                          
                          
                          <th className="p-4 font-semibold">Highest (5D)</th>
                          <th className="p-4 font-semibold pr-6 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {top5Results.slice(0, 5).map((stock, i) => (
                          <tr key={i} className="hover:bg-slate-800/30 transition group">
                            <td className="p-4 pl-6">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 font-bold text-xs border border-amber-500/20">
                                #{i + 1}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${stock.symbol.replace('.KL', '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-200 hover:text-amber-400 hover:underline transition cursor-pointer">{stock.originalName || stock.companyName}</a>
                                  {stock.ocrStatus && stock.ocrStatus !== '-' && (
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getStatusColor(stock.ocrStatus)}`}>
                                      {stock.ocrStatus}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500">{stock.symbol}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-amber-400">{stock.score}/10</span>
                            </td>
                            <td className="p-4 font-mono text-sm text-slate-300">{stock.price}</td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-mono text-sm font-bold text-rose-400">{stock.gannSL || stock.stopLoss}</span>
                                {showSniperDynamic && <span className="text-[10px] text-slate-500 mt-1">{stock.stopLoss}</span>}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-mono text-sm font-medium text-emerald-400">{stock.gannTP1 || stock.tp1}</span>
                                {showSniperDynamic && <span className="text-[10px] text-slate-500 mt-1">{stock.tp1}</span>}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-mono text-sm font-medium text-emerald-400">{stock.gannTP2 || stock.tp2}</span>
                                {showSniperDynamic && <span className="text-[10px] text-slate-500 mt-1">{stock.tp2}</span>}
                              </div>
                            </td>
                            
                            
                            <td className="p-4 font-mono text-sm text-slate-400">{stock.highest}</td>
                            <td className="p-4 pr-6 text-right">
                              <button
                                onClick={() => addToCustomText(stock.symbol, stock.originalName || stock.companyName)}
                                disabled={addingSymbol !== null}
                                className={`p-2 rounded-xl border transition inline-flex items-center justify-center cursor-pointer ${
                                  addingSymbol === stock.symbol.replace('.KL', '').replace('MYX:', '')
                                    ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                                    : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-400 border-slate-700 hover:border-emerald-500'
                                }`}
                                title="Tambah ke Custom Master List"
                              >
                                <span className="text-xs font-bold px-1 flex items-center gap-1">
                                  {addingSymbol === stock.symbol.replace('.KL', '').replace('MYX:', '') ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Adding</>
                                  ) : (
                                    <>➕ Add</>
                                  )}
                                </span>
                              </button>
                            </td>
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
            <div className="border border-slate-800 bg-slate-900/30 rounded-3xl p-8 backdrop-blur-sm mb-8">
              <h2 className="text-xl font-bold text-slate-200 mb-4">Manual Text Input</h2>
              <p className="text-sm text-slate-500 mb-4">Paste a list of stock codes or names (e.g. 2429, 4456, YTL). You can separate them by commas, spaces, or newlines.</p>

              {/* Info note */}
              <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 mb-6">
                <div className="mt-0.5 flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <div className="text-xs text-slate-400 leading-relaxed">
                  <span className="font-semibold text-blue-300">Cara mudah mendapatkan senarai kaunter:</span>
                  <ol className="mt-2 space-y-1 list-decimal list-inside text-slate-500">
                    <li>Buka halaman <a href="https://www.bursamalaysia.com/market_information/equities_prices" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition">Bursa Malaysia — Equities Prices</a></li>
                    <li>Pilih paparan <span className="text-slate-300 font-medium">Top Active</span> dan salin kandungan halaman (boleh salin beberapa halaman)</li>
                    <li>Tampal (<span className="text-slate-300 font-medium">Paste</span>) teks yang disalin ke dalam kotak di bawah</li>
                    <li>Sistem akan mengenal pasti kod saham secara automatik dan mengimbas kesemua kaunter</li>
                  </ol>
                </div>
              </div>
              
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="e.g. 2429, YTL, 0138, MYEG"
                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 focus:outline-none focus:border-amber-500/50 resize-none mb-6"
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
                  <h2 className="text-2xl font-bold text-slate-100 flex-1">Sniper Analysis Results</h2>
                  <button
                    onClick={handleSaveCustomToMaster}
                    disabled={isSavingCustom}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${
                      isSavingCustom
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
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
                
                <div className="border border-slate-800 bg-slate-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl mt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                          <th className="p-4 font-semibold pl-6">Rank</th>
                          <th className="p-4 font-semibold">Stock</th>
                          <th className="p-4 font-semibold">Score</th>
                          <th className="p-4 font-semibold">Last Done</th>
                          <th className="p-4 font-semibold text-rose-400/80">Stop Loss</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP1</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP2</th>
                          
                          
                          <th className="p-4 font-semibold pr-6">Highest (5D)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {top5Results.map((stock, i) => (
                          <tr key={i} className="hover:bg-slate-800/30 transition group">
                            <td className="p-4 pl-6">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 font-bold text-xs border border-amber-500/20">
                                #{i + 1}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${stock.symbol.replace('.KL', '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-200 hover:text-amber-400 hover:underline transition cursor-pointer">{stock.companyName || stock.originalName}</a>
                                <span className="text-[10px] text-slate-500">{stock.symbol}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-amber-400">{stock.score}/10</span>
                            </td>
                            <td className="p-4 font-mono text-sm text-slate-300">{stock.price}</td>
                            <td className={`p-4 font-mono text-sm font-bold ${stock.gannSLColor === 'red' ? 'text-rose-400' : stock.gannSLColor === 'blue' ? 'text-blue-400' : 'text-slate-400'}`}>{stock.gannSL}</td>
                            <td className={`p-4 font-mono text-sm font-medium ${stock.gannTP1Color === 'red' ? 'text-rose-400' : stock.gannTP1Color === 'blue' ? 'text-blue-400' : 'text-slate-400'}`}>{stock.gannTP1}</td>
                            <td className={`p-4 font-mono text-sm font-medium ${stock.gannTP2Color === 'red' ? 'text-rose-400' : stock.gannTP2Color === 'blue' ? 'text-blue-400' : 'text-slate-400'}`}>{stock.gannTP2}</td>
                            
                            
                            <td className="p-4 font-mono text-sm text-slate-400 pr-6">{stock.highest}</td>
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
              <div className="border border-slate-800 bg-slate-900/30 rounded-3xl p-12 text-center backdrop-blur-sm">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
                  <Power className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-200 mb-2">Live Market Screener</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-8">
                  Scan the top 80+ most active stocks in Bursa Malaysia instantly to find the best technical setups.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 mx-auto justify-center">
                  <button 
                    onClick={handleLiveScan}
                    className="group relative inline-flex items-center gap-3 px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-100 font-bold transition duration-300 active:scale-95"
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
              <div className="border border-slate-800 bg-slate-900/50 p-12 rounded-3xl flex flex-col items-center justify-center backdrop-blur-md relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-6" />
                <h3 className="text-xl font-bold text-slate-200">
                  {isUpdatingMaster ? 'Updating Master List' : 'Scanning Live Market'}
                </h3>
                <p className="text-sm text-slate-500 mt-2 text-center max-w-sm">
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
                    <h2 className="text-2xl font-bold text-slate-100">Top 30 Live Picks</h2>
                    <p className="text-slate-500 text-xs mt-1">
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
                        className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 w-36"
                      />
                      <button 
                        type="submit"
                        disabled={isSearching || isLiveScanning}
                        className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/20 rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center justify-center min-w-[70px]"
                      >
                        {isSearching ? <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"/> : 'Search'}
                      </button>
                    </form>
                    
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/50 border border-slate-800 mx-1">
                      <span className="text-xs font-medium text-slate-400 select-none">Dynamic</span>
                      <button 
                        onClick={() => setShowDynamic(!showDynamic)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${showDynamic ? 'bg-amber-500' : 'bg-slate-700'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showDynamic ? 'translate-x-4' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <button 
                      onClick={handleLiveScan}
                      disabled={isLiveScanning || isUpdatingMaster}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold transition disabled:opacity-50"
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
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl transition"
                      title="Refresh Page"
                    >
                      <RefreshCcw className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="border border-slate-800 bg-slate-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                          <th className="p-4 font-semibold pl-6">Rank</th>
                          <th className="p-4 font-semibold">Stock</th>
                          <th className="p-4 font-semibold">Score</th>
                          <th className="p-4 font-semibold">Last Done</th>
                          <th className="p-4 font-semibold text-rose-400/80">Stop Loss<br/>{showDynamic && <span className="text-[10px] text-slate-600">Stat / Dyn</span>}</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP1<br/>{showDynamic && <span className="text-[10px] text-slate-600">Stat / Dyn</span>}</th>
                          <th className="p-4 font-semibold text-emerald-400/80">TP2<br/>{showDynamic && <span className="text-[10px] text-slate-600">Stat / Dyn</span>}</th>
                          
                          
                          <th className="p-4 font-semibold pr-6">Highest (5D)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
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
                            <td className="p-4 font-mono text-sm text-slate-300">{searchedStock.price}</td>
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
                                  <span className={`font-mono text-sm font-medium ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.staticTP1) ? 'bg-slate-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{searchedStock.staticTP1}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.tp1) || searchedStock.hitTp1 ? 'text-slate-600' : 'text-emerald-500/50'}`}>{searchedStock.tp1}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticTP2Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.staticTP2) ? 'bg-slate-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{searchedStock.staticTP2}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.tp2) || searchedStock.hitTp2 ? 'text-slate-600' : 'text-emerald-500/50'}`}>{searchedStock.tp2}</span>}
                              </div>
                            </td>
                            
                            
                            <td className="p-4 font-mono text-sm text-slate-500 pr-6">{searchedStock.highestPrice}</td>
                          </tr>
                        )}
                        {liveResults.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/30 transition group">
                            <td className="p-4 pl-6 relative">
                              <div className="flex items-center gap-2">
                                {/* Label flag */}
                                <div className="relative">
                                  <button
                                    onClick={() => setLabelPickerOpen(labelPickerOpen === row.symbol ? null : row.symbol)}
                                    className={`w-5 h-5 flex items-center justify-center transition rounded opacity-0 group-hover:opacity-100 ${row.labelColor ? '!opacity-100' : ''}`}
                                    title={row.labelColor ? 'Tukar label warna' : 'Tambah label warna'}
                                  >
                                    <svg viewBox="0 0 12 16" fill={row.labelColor || '#64748b'} className="w-3.5 h-4 drop-shadow-sm" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M0 0h12v16l-6-4-6 4z"/>
                                    </svg>
                                  </button>
                                  {/* Color Picker Popup */}
                                  {labelPickerOpen === row.symbol && (
                                    <div className="absolute left-0 top-7 z-50 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150" onClick={e => e.stopPropagation()}>
                                      {LABEL_COLORS.map(c => (
                                        <button
                                          key={c.id}
                                          onClick={() => setStockLabelColor(row.symbol, row.labelColor === c.bg ? null : c.bg)}
                                          className={`w-6 h-6 rounded-full transition hover:scale-125 focus:outline-none border-2 ${row.labelColor === c.bg ? 'border-white scale-110' : 'border-transparent'}`}
                                          style={{ backgroundColor: c.bg }}
                                          title={c.label}
                                        />
                                      ))}
                                      {row.labelColor && (
                                        <button onClick={() => setStockLabelColor(row.symbol, null)} className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition text-xs border-2 border-transparent" title="Padam label">✕</button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10 text-amber-500 font-bold text-xs border border-amber-500/20">
                                  #{idx + 1}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${row.symbol.replace('.KL', '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-200 hover:text-slate-100 hover:underline transition cursor-pointer">{row.companyName}</a>
                                  {row.isManual && (
                                    <span title="Ditambah secara manual" className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[9px] leading-none" style={{fontSize:'8px'}}>★</span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500">{row.companyName} ({row.symbol})</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-amber-400">{row.score}/10</span>
                            </td>
                            <td className="p-4 font-mono text-sm text-slate-300">{row.price}</td>
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
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP1) ? 'bg-slate-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{row.staticTP1}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp1) || row.hitTp1 ? 'text-slate-600' : 'text-emerald-500/50'}`}>{row.tp1}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP2Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP2) ? 'bg-slate-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{row.staticTP2}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp2) || row.hitTp2 ? 'text-slate-600' : 'text-emerald-500/50'}`}>{row.tp2}</span>}
                              </div>
                            </td>
                            
                            
                            <td className="p-4 font-mono text-sm text-slate-500 pr-6">{row.highestPrice}</td>
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
              <div className="border border-slate-800 bg-slate-900/30 rounded-3xl p-12 text-center backdrop-blur-sm">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
                  <Power className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-200 mb-2">Custom Master List</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-8">
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
                    className="group relative inline-flex items-center gap-3 px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-100 font-bold transition duration-300 active:scale-95"
                  >
                    <span>Muat Semula senarai tersimpan</span>
                  </button>
                </div>
              </div>
            )}

            {isFetchingCustomMaster && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                <p className="text-slate-400 font-medium">Fetching custom master list...</p>
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
                      <div className="flex flex-col">
                        <h2 className="text-2xl font-bold text-slate-100">Custom Master List</h2>
                        <p className="text-sm font-medium text-amber-500/90 mt-0.5">
                          Tempoh seminggu: {getWeeklyTradePeriod()}
                        </p>
                      </div>
                    </div>
                    {lastCustomMasterUpdate && (
                      <p className="text-sm text-slate-500 mt-2 flex items-center gap-2">
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
                        className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 w-36"
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
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${showDynamic ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
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
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-2"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" /> Refresh
                    </button>
                    <button
                      onClick={() => {
                        if (customTopPicks.length > 0) {
                          setCustomTopPicks([]);
                        } else {
                          findCustomTopPicks();
                        }
                      }}
                      className="px-4 py-2 bg-amber-600/20 border border-amber-500/30 text-amber-500 hover:bg-amber-600 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
                    >
                      <Trophy className="w-3.5 h-3.5" /> Top 3 Picks
                    </button>
                  </div>
                </div>

                {customTopPicks.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-amber-500/20">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-amber-400">Top 3 Sniper Picks 🎯</h3>
                        <p className="text-sm text-amber-500/70">The absolute best setups from your custom master list.</p>
                      </div>
                      <button 
                        onClick={() => setCustomTopPicks([])}
                        className="ml-auto p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition"
                        title="Close Top Picks"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {customTopPicks.map((res, i) => {
                        const score = res.score || 0;
                        const price = parseFloat(res.currentPrice || res.price || 0);
                        const name = res.companyName || '';
                        
                        return (
                          <div key={i} className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-br from-amber-500/40 to-orange-600/10 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
                            <div className="relative p-6 rounded-2xl border border-amber-500/30 bg-slate-950/80 backdrop-blur-sm flex flex-col gap-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${(res.symbol || '').replace('.KL', '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-2xl text-slate-100 hover:text-blue-400 transition cursor-pointer">{name}</a>
                                    {i === 0 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950">#1</span>}
                                    {i === 1 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-300 text-slate-950">#2</span>}
                                    {i === 2 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-700 text-slate-100">#3</span>}
                                  </div>
                                  <span className="block text-sm text-slate-400 mt-1">RM {price ? price.toFixed(3) : '-'}</span>
                                  <span className="block text-xs font-mono text-slate-600 mt-1">{res.companyName} ({res.symbol})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newIgnored = [...ignoredCustomPicks, res.symbol];
                                      setIgnoredCustomPicks(newIgnored);
                                      findCustomTopPicks(newIgnored);
                                    }}
                                    className="p-1.5 rounded-lg text-amber-500/50 hover:text-rose-400 hover:bg-rose-500/20 transition"
                                    title="Ignore this pick"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              
                              <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-800">
                                <div>
                                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Sniper Score</span>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black text-amber-400">{score}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="border border-slate-800 bg-slate-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                          <th className="p-4 font-semibold w-16 pl-6">Rank</th>
                          <th className="p-4 font-semibold w-48">Stock</th>
                          <th className="p-4 font-semibold w-24">Score</th>
                          <th className="p-4 font-semibold w-32">
                            <div className="flex flex-col">
                              <span>Last Done</span>
                              <span className="text-[10px] text-slate-500 font-normal capitalize">
                                {searchedStock?.lastDoneDate || (customMasterResults.length > 0 ? customMasterResults[0].lastDoneDate : '') || '(Date)'}
                              </span>
                            </div>
                          </th>
                          <th className="p-4 font-semibold w-24">Last Price</th>
                          <th className="p-4 font-semibold text-rose-400/80 w-32">Stop Loss</th>
                          <th className="p-4 font-semibold text-emerald-400/80 w-32">TP1</th>
                          <th className="p-4 font-semibold text-emerald-400/80 w-32">TP2</th>
                          
                          
                          <th className="p-4 font-semibold w-32">
                            <div className="flex flex-col">
                              <span>Highest</span>
                              <span className="text-[10px] text-slate-500 font-normal">
                                (Since {searchedStock?.lastDoneDate || (customMasterResults.length > 0 ? customMasterResults[0].lastDoneDate : '') || '10 Jul'})
                              </span>
                            </div>
                          </th>
                          <th className="p-4 font-semibold pr-6 text-right w-20">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
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
                            <td className="p-4 font-mono text-sm text-slate-300">
                              {searchedStock.price}
                            </td>
                            <td className="p-4">
                              {(() => {
                                const cur = parseFloat(searchedStock.currentPrice || searchedStock.price);
                                const isGolden = cur > parseFloat(searchedStock.staticSL) && cur < parseFloat(searchedStock.staticTP1) && cur > parseFloat(searchedStock.price);
                                return (
                                  <div className={`flex w-fit items-center gap-1.5 font-mono text-sm ${isGolden ? 'bg-emerald-600 text-white px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(5,150,105,0.6)]' : 'text-slate-300'}`}>
                                    <span className={isGolden ? 'font-bold' : ''}>{searchedStock.currentPrice || searchedStock.price}</span>
                                    {cur > parseFloat(searchedStock.price) ? (
                                      <TrendingUp className={`w-3.5 h-3.5 ${isGolden ? 'text-white' : 'text-emerald-400'}`} />
                                    ) : cur < parseFloat(searchedStock.price) ? (
                                      <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticSLColor === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-bold ${parseFloat(searchedStock.currentPrice || searchedStock.price) < parseFloat(searchedStock.staticSL) ? 'bg-rose-600 text-white px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.6)]' : 'text-rose-400'}`}>{searchedStock.staticSL}</span>
                                </div>
                                {showDynamic && <span className="font-mono text-xs font-medium text-rose-500/50 pl-3">{searchedStock.stopLoss}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticTP1Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.staticTP1) ? 'bg-slate-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{searchedStock.staticTP1}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.tp1) || searchedStock.hitTp1 ? 'text-slate-600' : 'text-emerald-500/50'}`}>{searchedStock.tp1}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${searchedStock.staticTP2Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.staticTP2) ? 'bg-slate-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{searchedStock.staticTP2}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(searchedStock.highestPrice) >= parseFloat(searchedStock.tp2) || searchedStock.hitTp2 ? 'text-slate-600' : 'text-emerald-500/50'}`}>{searchedStock.tp2}</span>}
                              </div>
                            </td>
                            
                            
                            <td className="p-4 font-mono text-sm text-slate-500">{searchedStock.highestPrice}</td>
                            <td className="p-4 pr-6 text-right">
                              <button
                                onClick={async () => {
                                  await addToCustomText(searchedStock.symbol, searchedStock.companyName, true);
                                  setSearchedStock(null);
                                  setSearchQuery('');
                                }}
                                disabled={addingSymbol !== null}
                                className={`p-2 rounded-xl border transition inline-flex items-center justify-center cursor-pointer ${
                                  addingSymbol === searchedStock.symbol.replace('.KL', '').replace('MYX:', '')
                                    ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                                    : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-400 border-slate-700 hover:border-emerald-500'
                                }`}
                                title="Tambah ke Custom Watchlist"
                              >
                                <span className="text-xs font-bold px-1 flex items-center gap-1">
                                  {addingSymbol === searchedStock.symbol.replace('.KL', '').replace('MYX:', '') ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Adding</>
                                  ) : (
                                    <>➕ Add</>
                                  )}
                                </span>
                              </button>
                            </td>
                          </tr>
                        )}
                        {customMasterResults.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30 transition group">
                            <td className="p-4 pl-6 relative">
                              <div className="flex items-center gap-2">
                                {/* Label flag */}
                                <div className="relative">
                                  <button
                                    onClick={() => setLabelPickerOpen(labelPickerOpen === row.symbol ? null : row.symbol)}
                                    className={`w-5 h-5 flex items-center justify-center transition rounded opacity-0 group-hover:opacity-100 ${row.labelColor ? '!opacity-100' : ''}`}
                                    title={row.labelColor ? 'Tukar label warna' : 'Tambah label warna'}
                                  >
                                    <svg viewBox="0 0 12 16" fill={row.labelColor || '#64748b'} className="w-3.5 h-4 drop-shadow-sm" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M0 0h12v16l-6-4-6 4z"/>
                                    </svg>
                                  </button>
                                  {/* Color Picker Popup */}
                                  {labelPickerOpen === row.symbol && (
                                    <div className="absolute left-0 top-7 z-50 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150" onClick={e => e.stopPropagation()}>
                                      {LABEL_COLORS.map(c => (
                                        <button
                                          key={c.id}
                                          onClick={() => setStockLabelColor(row.symbol, row.labelColor === c.bg ? null : c.bg)}
                                          className={`w-6 h-6 rounded-full transition hover:scale-125 focus:outline-none border-2 ${row.labelColor === c.bg ? 'border-white scale-110' : 'border-transparent'}`}
                                          style={{ backgroundColor: c.bg }}
                                          title={c.label}
                                        />
                                      ))}
                                      {row.labelColor && (
                                        <button onClick={() => setStockLabelColor(row.symbol, null)} className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white transition text-xs border-2 border-transparent" title="Padam label">✕</button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 font-bold text-xs border border-blue-500/20">
                                  #{idx + 1}
                                </span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <a href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${row.symbol.replace('.KL', '')}`} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-200 hover:text-blue-400 hover:underline transition cursor-pointer">{row.companyName}</a>
                                  {row.isManual && (
                                    <span title="Ditambah secara manual" className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[9px] leading-none" style={{fontSize:'8px'}}>★</span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">{row.symbol}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-blue-400">{row.score}/10</span>
                            </td>
                            <td className="p-4 font-mono text-sm text-slate-300">
                              {row.price}
                            </td>
                            <td className="p-4">
                              {(() => {
                                const cur = parseFloat(row.currentPrice || row.price);
                                const isGolden = cur > parseFloat(row.staticSL) && cur < parseFloat(row.staticTP1) && cur > parseFloat(row.price);
                                return (
                                  <div className={`flex w-fit items-center gap-1.5 font-mono text-sm ${isGolden ? 'bg-emerald-600 text-white px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(5,150,105,0.6)]' : 'text-slate-300'}`}>
                                    <span className={isGolden ? 'font-bold' : ''}>{row.currentPrice || row.price}</span>
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
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.currentPrice || row.price) < parseFloat(row.staticSL) ? 'bg-rose-600 text-white px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.6)]' : 'text-rose-400'}`}>{row.staticSL}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.price) <= parseFloat(row.stopLoss) ? 'text-rose-500' : 'text-rose-400/50'}`}>{row.stopLoss}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP1Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP1) ? 'bg-slate-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{row.staticTP1}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp1) || row.hitTp1 ? 'text-slate-600' : 'text-emerald-500/50'}`}>{row.tp1}</span>}
                              </div>
                            </td>
                            <td className={`p-4`}>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${row.staticTP2Color === 'blue' ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`} />
                                  <span className={`font-mono text-sm font-medium ${parseFloat(row.highestPrice) >= parseFloat(row.staticTP2) ? 'bg-slate-700/30 text-yellow-400 px-1 rounded' : 'text-emerald-400'}`}>{row.staticTP2}</span>
                                </div>
                                {showDynamic && <span className={`font-mono text-xs font-medium pl-3 ${parseFloat(row.highestPrice) >= parseFloat(row.tp2) || row.hitTp2 ? 'text-slate-600' : 'text-emerald-500/50'}`}>{row.tp2}</span>}
                              </div>
                            </td>
                            
                            
                            <td className="p-4 font-mono text-sm text-slate-500">{row.highestPrice}</td>
                            <td className="p-4 pr-6 text-right">
                              <button
                                onClick={() => deleteFromCustom(row.symbol, row.companyName)}
                                className="p-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition inline-flex items-center justify-center cursor-pointer"
                                title="Padam kaunter dari Watchlist"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
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

        {/* iSaham Top Active Tab */}
        {activeTab === 'topActive' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-100">
                    {selectedScreener === 'top-active' 
                      ? 'Top Active Volume (iSaham)' 
                      : selectedScreener === 'jerung-x' 
                      ? 'Jerung X Screener (iSaham Pro)'
                      : 'Super Short Term Screener (iSaham Pro)'}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {selectedScreener === 'top-active'
                      ? `Senarai 20 kaunter paling aktif didagang. ${hasUnlockedScores ? '✨ Pro Unlocked: Disusun mengikut iSaham Score' : 'Log masuk tetapan untuk susunan Pro.'}`
                      : selectedScreener === 'jerung-x'
                      ? 'Mengesan kaunter yang sedang dikumpul secara aktif/senyap oleh pelabur institusi (Jerung).'
                      : 'Mengesan kaunter yang mempunyai momentum kenaikan jangka pendek yang sangat kuat (Super Short Term).'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <select
                  value={selectedScreener}
                  onChange={(e) => handleScreenerChange(e.target.value as 'top-active' | 'jerung-x' | 'isaham-super-short-term')}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="top-active">📈 Top Active Volume</option>
                  <option value="jerung-x">🐋 Jerung X (Whales)</option>
                  <option value="isaham-super-short-term">⚡ Super Short Term</option>
                </select>

                <button
                  onClick={() => setShowPasteModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/20"
                >
                  📋 Paste Data
                </button>

                <button
                  onClick={() => fetchTopActive()}
                  disabled={isFetchingTopActive}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-2 w-fit disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCcw className={`w-3.5 h-3.5 ${isFetchingTopActive ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
            </div>


            {topActiveError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center mb-6 flex flex-col items-center justify-center gap-2">
                <p>{topActiveError}</p>
                <button
                  onClick={() => setShowPasteModal(true)}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-xs font-bold border border-red-500/30 transition cursor-pointer"
                >
                  Tampal (Paste) Data Secara Manual
                </button>
              </div>
            )}


            {isFetchingTopActive ? (
              <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-3xl border border-slate-800/50 backdrop-blur-sm">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-4" />
                <p className="text-sm text-slate-400">Menarik data dari iSaham...</p>
              </div>
            ) : topActiveResults.length > 0 ? (
              <div className="border border-slate-800 bg-slate-950/80 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                        <th className="p-4 font-semibold w-16 pl-6">Rank</th>
                        <th className="p-4 font-semibold w-48">Stock</th>
                        <th className="p-4 font-semibold w-24">Last Price</th>
                        <th className="p-4 font-semibold w-24">Change %</th>
                        <th className="p-4 font-semibold w-28">Volume</th>
                        <th className="p-4 font-semibold w-28">Market Cap</th>
                        <th className="p-4 font-semibold w-24">LTS Score</th>
                        <th className="p-4 font-semibold w-24">iSaham Score</th>
                        <th className="p-4 font-semibold pr-6 text-right w-24">Act</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {topActiveResults.map((row, idx) => {
                        const changeColor = row.change > 0 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : row.change < 0 ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-slate-400 bg-slate-800/50 border-slate-700/50';
                        return (
                          <tr key={idx} className="hover:bg-slate-800/30 transition group">
                            <td className="p-4 pl-6">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-xs border border-emerald-500/20">
                                #{row.rank || idx + 1}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <a 
                                  href={`https://www.tradingview.com/chart/S83uhZmn/?symbol=MYX:${row.symbol}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="font-bold text-slate-200 hover:text-emerald-400 hover:underline transition cursor-pointer"
                                >
                                  {row.name || row.symbol}
                                </a>
                                <span className="text-[10px] text-slate-500 font-mono mt-0.5">{row.symbol}</span>
                              </div>
                            </td>
                            <td className="p-4 font-mono text-sm text-slate-300">
                              RM {row.price.toFixed(3)}
                            </td>
                            <td className="p-4">
                              {row.change !== 0 ? (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${changeColor}`}>
                                  {row.change > 0 ? '+' : ''}{row.change.toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-slate-600 font-mono text-sm">-</span>
                              )}
                            </td>
                            <td className="p-4 font-mono text-sm text-slate-400">
                              {row.volume > 0 ? row.volume.toLocaleString('en-US') : '-'}
                            </td>
                            <td className="p-4 font-mono text-sm text-slate-400">
                              {row.marketCap > 0 ? `RM ${row.marketCap.toLocaleString('en-US')} M` : '-'}
                            </td>
                            <td className="p-4 font-mono text-sm text-slate-400">
                              {row.ltsScore > 0 ? (
                                <span className="text-blue-400 font-bold">{row.ltsScore.toFixed(2)}</span>
                              ) : selectedScreener !== 'top-active' ? (
                                <span className="text-slate-600">-</span>
                              ) : (
                                <span className="text-slate-600" title="Pro Session Required">🔒 Locked</span>
                              )}
                            </td>
                            <td className="p-4 font-mono text-sm text-slate-400">
                              {row.isahamScore > 0 ? (
                                <span className="text-amber-400 font-bold">{row.isahamScore.toFixed(1)}</span>
                              ) : selectedScreener !== 'top-active' ? (
                                <span className="text-slate-600">-</span>
                              ) : (
                                <span className="text-slate-600" title="Pro Session Required">🔒 Locked</span>
                              )}
                            </td>
                            <td className="p-4 pr-6 text-right">
                              <button
                                onClick={() => addToCustomText(row.symbol, row.name)}
                                disabled={addingSymbol !== null}
                                className={`p-2 rounded-xl border transition inline-flex items-center justify-center cursor-pointer ${
                                  addingSymbol === row.symbol.replace('.KL', '').replace('MYX:', '')
                                    ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                                    : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-400 border-slate-700 hover:border-emerald-500'
                                }`}
                                title="Tambah ke Custom Watchlist"
                              >
                                <span className="text-xs font-bold px-1 flex items-center gap-1">
                                  {addingSymbol === row.symbol.replace('.KL', '').replace('MYX:', '') ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Adding</>
                                  ) : (
                                    <>➕ Add</>
                                  )}
                                </span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-3xl border border-slate-800/50 backdrop-blur-sm">
                <Loader2 className="w-10 h-10 text-slate-600 mb-4" />
                <p className="text-sm text-slate-500">Tiada data dijumpai.</p>
              </div>
            )}

            {/* Cookie Modal */}
            {showCookieModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative">
                  <button 
                    onClick={() => setShowCookieModal(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h4 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
                    🔑 iSaham Pro Cookies Settings
                  </h4>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    Tampal <strong>Cookie String</strong> lengkap daripada Chrome Console anda di bawah untuk membolehkan sistem menarik <em>iSaham Score</em> &amp; <em>LTS Score</em> serta membuat susunan pintar.
                  </p>
                  
                  <textarea
                    value={isahamCookie}
                    onChange={(e) => setIsahamCookie(e.target.value)}
                    placeholder="Tampal cookie di sini... (cth: _fbp=...; username=...; login=...)"
                    className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500 resize-none mb-4"
                  />

                  <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/40 mb-5 text-[11px] text-slate-400 leading-relaxed">
                    <strong className="text-amber-400">Cara dapatkan:</strong> Di laman iSaham (log masuk), buka <strong>Chrome Console (F12)</strong>, taip <code>copy(document.cookie)</code> dan tekan Enter. Kemudian <strong>Paste (Ctrl+V)</strong> di atas.
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/system-settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ key: 'isaham_cookie', value: '' })
                          });
                          const data = await res.json();
                          if (data.success) {
                            setIsahamCookie('');
                            setShowCookieModal(false);
                            fetchTopActive();
                          } else {
                            alert('Gagal membersihkan cookie dari database: ' + data.error);
                          }
                        } catch (err: any) {
                          alert('Ralat sambungan: ' + err.message);
                        }
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Clear Cookie
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/system-settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ key: 'isaham_cookie', value: isahamCookie })
                          });
                          const data = await res.json();
                          if (data.success) {
                            setShowCookieModal(false);
                            fetchTopActive();
                          } else {
                            alert('Gagal menyimpan cookie ke database: ' + data.error);
                          }
                        } catch (err: any) {
                          alert('Ralat sambungan: ' + err.message);
                        }
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-900/20 cursor-pointer"
                    >
                      Save &amp; Reload
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Paste Data Modal */}
            {showPasteModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl relative">
                  <button 
                    onClick={() => setShowPasteModal(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <h4 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2">
                    📋 Tampal Data Screener iSaham
                  </h4>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    Sila salin (*copy*) jadual atau respons API dari iSaham dan tampalkan di bawah. Sistem akan menganalisis data secara automatik dan menyimpannya ke pangkalan data D1.
                  </p>
                  
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Tampal data di sini... (Salin dari jadual laman web iSaham secara terus, atau salin respons JSON dari Network tab)"
                    className="w-full h-48 bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500 resize-none mb-4"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                    <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/40 text-[11px] text-slate-400 leading-relaxed">
                      <strong className="text-emerald-400">💡 Cara A (Paling Mudah):</strong>
                      <ol className="list-decimal pl-4 mt-1 space-y-0.5">
                        <li>Buka screener pilihan di iSaham (cth: Jerung X).</li>
                        <li>Tekan <strong>Ctrl+A / Cmd+A</strong> untuk select semua kandungan, atau drag &amp; select jadual saham.</li>
                        <li><strong>Copy (Ctrl+C)</strong> dan <strong>Paste (Ctrl+V)</strong> dalam kotak di atas.</li>
                      </ol>
                    </div>
                    <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/40 text-[11px] text-slate-400 leading-relaxed">
                      <strong className="text-emerald-400">⚡ Cara B (Sangat Tepat):</strong>
                      <ol className="list-decimal pl-4 mt-1 space-y-0.5">
                        <li>Buka <strong>Inspect &rarr; Network</strong> tab di Chrome.</li>
                        <li>Reload screener iSaham. Cari request API yang dipanggil (cth: <code>jerung-x</code>).</li>
                        <li>Right-click &rarr; <strong>Copy response</strong>, tampal di atas.</li>
                      </ol>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setPasteText('');
                        setShowPasteModal(false);
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSavePastedData}
                      disabled={isSavingPaste || !pasteText.trim()}
                      className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-900/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingPaste ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...</>
                      ) : (
                        <>Simpan &amp; Kemaskini</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
