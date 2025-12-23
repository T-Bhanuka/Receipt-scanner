
import React, { useState, useEffect, useRef } from 'react';
import { Receipt, Category, ReceiptItem, GalleryImage } from './types';
import { analyzeReceipt } from './services/geminiService';
import CameraScanner from './components/CameraScanner';
import Dashboard from './components/Dashboard';
import * as storage from './services/storageService';

const App: React.FC = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState(20000);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'gallery' | 'history'>('dashboard');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Entry Form State
  const [manualForm, setManualForm] = useState<{
    storeName: string;
    date: string;
    time: string;
    category: Category;
    items: { name: string; price: string; category: Category }[];
  }>({
    storeName: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    category: Category.Other,
    items: [{ name: '', price: '', category: Category.Other }]
  });

  useEffect(() => {
    const loadData = async () => {
      const saved = localStorage.getItem('receipt_app_pro_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        setReceipts(parsed.receipts || []);
        setMonthlyBudget(parsed.monthlyBudget || 20000);
      }
      
      try {
        const images = await storage.getAllGalleryImages();
        setGalleryImages(images.sort((a, b) => b.timestamp - a.timestamp));
      } catch (e) {
        console.error("Failed to load gallery", e);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    localStorage.setItem('receipt_app_pro_v5', JSON.stringify({ receipts, monthlyBudget }));
  }, [receipts, monthlyBudget]);

  const processImage = async (imageObj: GalleryImage) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const data = await analyzeReceipt(imageObj.base64);
      
      if (!data.isReadable) {
        setAnalysisError("Could not read receipt details. You can try again or enter manually.");
        return;
      }

      const newReceipt: Receipt = {
        id: crypto.randomUUID(),
        storeName: data.storeName || 'Unknown Store',
        date: data.date || new Date().toISOString().split('T')[0],
        time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        items: data.items || [],
        total: data.total || 0,
        category: (data.category as Category) || Category.Other,
        timestamp: Date.now(),
        galleryImageId: imageObj.id
      };

      const updatedImg = { ...imageObj, isProcessed: true, linkedReceiptId: newReceipt.id };
      await storage.saveGalleryImage(updatedImg);
      
      setGalleryImages(prev => prev.map(img => img.id === imageObj.id ? updatedImg : img));
      setReceipts(prev => [newReceipt, ...prev]);
      setActiveTab('history');
    } catch (error) {
      setAnalysisError("Connection error. Image saved to gallery for later processing.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCapture = async (base64: string) => {
    setShowScanner(false);
    setIsFabOpen(false);
    const newImg: GalleryImage = {
      id: crypto.randomUUID(),
      base64,
      timestamp: Date.now(),
      isProcessed: false
    };

    try {
      await storage.saveGalleryImage(newImg);
      setGalleryImages(prev => [newImg, ...prev]);
      setActiveTab('gallery');
      if (navigator.onLine) {
        await processImage(newImg);
      } else {
        setAnalysisError("Offline: Image saved to gallery. Scan when back online.");
      }
    } catch (e) {
      setAnalysisError("Failed to save image to gallery.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      handleCapture(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setIsFabOpen(false);
  };

  const deleteGalleryItem = async (id: string) => {
    try {
      await storage.deleteGalleryImage(id);
      setGalleryImages(prev => prev.filter(img => img.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const removeItemFromReceipt = (receiptId: string, itemIndex: number) => {
    setReceipts(prev => prev.map(receipt => {
      if (receipt.id === receiptId) {
        const newItems = receipt.items.filter((_, idx) => idx !== itemIndex);
        const newTotal = newItems.reduce((sum, item) => sum + item.price, 0);
        return { ...receipt, items: newItems, total: newTotal };
      }
      return receipt;
    }));
  };

  const deleteReceipt = (receiptId: string) => {
    if (!confirm('Delete this bill? This action cannot be undone.')) return;
    setReceipts(prev => prev.filter(r => r.id !== receiptId));
  };

  const deleteAllReceipts = () => {
    if (!confirm('Delete ALL bills? This will remove your entire bill archive.')) return;
    setReceipts([]);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const total = manualForm.items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const newReceipt: Receipt = {
      id: crypto.randomUUID(),
      storeName: manualForm.storeName || 'Manual Entry',
      date: manualForm.date,
      time: manualForm.time,
      items: manualForm.items.map(i => ({
        name: i.name,
        price: parseFloat(i.price) || 0,
        category: i.category
      })),
      total,
      category: manualForm.category,
      timestamp: Date.now()
    };

    setReceipts(prev => [newReceipt, ...prev]);
    setShowManualEntry(false);
    setActiveTab('history');
    setManualForm({
      storeName: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      category: Category.Other,
      items: [{ name: '', price: '', category: Category.Other }]
    });
  };

  return (
    <div className="min-h-screen text-slate-100 selection:bg-purple-500/30 font-sans pb-32">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-900/60 backdrop-blur-xl border-b border-slate-800 p-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-400">
              SmartScan Pro
            </h1>
          </div>
          <button 
            onClick={() => {
              const newBudget = prompt("Set monthly budget (Rs.):", monthlyBudget.toString());
              if (newBudget && !isNaN(Number(newBudget))) setMonthlyBudget(Number(newBudget));
            }}
            className="text-xs font-semibold px-4 py-2 bg-slate-800 border border-slate-700 rounded-full hover:bg-slate-700 transition-all"
          >
            Rs. {monthlyBudget.toLocaleString()}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-4 pt-6 min-h-[calc(100vh-140px)]">
        {analysisError && (
          <div className="mb-6 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-4 py-3 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <p className="text-sm font-medium">{analysisError}</p>
            </div>
            <button onClick={() => setAnalysisError(null)} className="text-indigo-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && <Dashboard receipts={receipts} monthlyBudget={monthlyBudget} />}

        {activeTab === 'gallery' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                Receipt Gallery
              </h2>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full">
                {galleryImages.filter(i => !i.isProcessed).length} Unprocessed
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {galleryImages.length === 0 ? (
                <div className="col-span-2 py-24 bg-slate-900/40 rounded-3xl border border-slate-800 border-dashed text-center">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={2}/></svg>
                  </div>
                  <p className="text-slate-500 text-sm font-medium">Your digital receipt vault is empty.</p>
                  <p className="text-slate-600 text-xs mt-1">Tap the plus button to add receipts.</p>
                </div>
              ) : (
                galleryImages.map(img => (
                  <div key={img.id} className="relative group aspect-[3/4] rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl transition-all hover:border-indigo-500/50">
                    <img src={`data:image/jpeg;base64,${img.base64}`} className="w-full h-full object-cover" alt="Receipt" />
                    
                    {!img.isProcessed ? (
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-4">
                        <div className="bg-indigo-500 text-white text-[10px] font-black px-3 py-1 rounded-full mb-3 shadow-lg flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                          READY TO SCAN
                        </div>
                        <button 
                          disabled={isAnalyzing}
                          onClick={() => processImage(img)}
                          className="w-14 h-14 bg-white text-indigo-600 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
                        >
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={3}/></svg>
                        </button>
                      </div>
                    ) : (
                      <div className="absolute top-2 right-2 bg-emerald-500/90 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                        PROCESSED
                      </div>
                    )}

                    <button 
                      onClick={() => deleteGalleryItem(img.id)}
                      className="absolute bottom-2 right-2 p-2 bg-red-500/20 text-red-500 rounded-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/40"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                Bill Archive
              </h2>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowManualEntry(true)}
                  className="text-xs font-bold px-3 py-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/30 transition-all"
                >
                  + Add Manual
                </button>
                <button
                  onClick={deleteAllReceipts}
                  className="text-xs font-bold px-3 py-1.5 bg-red-500/10 text-red-300 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all"
                >
                  Clear All
                </button>
              </div>
            </div>
            {receipts.length === 0 ? (
               <div className="py-24 bg-slate-900/40 rounded-3xl border border-slate-800 border-dashed text-center">
                <p className="text-slate-500 text-sm font-medium">No spending recorded yet.</p>
              </div>
            ) : (
              receipts.map(receipt => (
                <div key={receipt.id} className="group bg-slate-900/80 border border-slate-800 rounded-3xl p-6 hover:border-purple-500/40 shadow-lg transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-100 text-xl group-hover:text-purple-300 transition-colors truncate pr-2">{receipt.storeName}</h3>
                      <div className="flex gap-3 mt-1 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                        <span>{receipt.date}</span>
                        <span>•</span>
                        <span>{receipt.time}</span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <span className="text-2xl font-black text-white">Rs. {receipt.total.toLocaleString()}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => deleteReceipt(receipt.id)}
                          className="text-red-400 text-xs font-bold px-2 py-1 bg-red-500/10 rounded-lg hover:bg-red-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {receipt.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-800/30 p-3 rounded-xl border border-slate-700/20 group/item relative">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-200 font-semibold">{item.name}</span>
                          <span className="text-[9px] uppercase font-black text-indigo-400 tracking-wider">{item.category}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-bold text-slate-100">Rs. {item.price.toFixed(2)}</span>
                          <button 
                            onClick={() => removeItemFromReceipt(receipt.id, idx)}
                            className="text-red-500/30 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* FAB Interaction Layer */}
      {isFabOpen && <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[55] transition-opacity" onClick={() => setIsFabOpen(false)}></div>}

      {/* Speed Dial FAB */}
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-[60]">
        <div className={`flex flex-col gap-3 transition-all duration-300 ${isFabOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-50 pointer-events-none'}`}>
          <button 
            onClick={() => { fileInputRef.current?.click(); setIsFabOpen(false); }}
            className="group flex items-center gap-3 bg-slate-900 border border-slate-700 p-3 pr-5 rounded-2xl shadow-xl hover:border-purple-500/50 transition-all hover:bg-slate-800"
          >
            <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth={2}/></svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-slate-300">Upload Gallery</span>
          </button>
          
          <button 
            onClick={() => { setShowScanner(true); setIsFabOpen(false); }}
            className="group flex items-center gap-3 bg-slate-900 border border-slate-700 p-3 pr-5 rounded-2xl shadow-xl hover:border-purple-500/50 transition-all hover:bg-slate-800"
          >
            <div className="w-10 h-10 bg-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth={2}/><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2}/></svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-slate-300">Camera Scan</span>
          </button>
        </div>

        <button 
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`w-20 h-20 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-purple-500/40 hover:scale-110 active:scale-90 transition-all transform ${isFabOpen ? 'rotate-45' : 'rotate-0'}`}
        >
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-2xl border-t border-slate-800 pb-safe z-50">
        <div className="max-w-2xl mx-auto px-10 py-5 flex justify-between items-center relative">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex flex-col items-center gap-1.5 group transition-all ${activeTab === 'dashboard' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <div className={`p-1 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-500/10' : ''}`}>
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeWidth={2}/></svg>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">Analytics</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('gallery')} 
            className={`flex flex-col items-center gap-1.5 group transition-all ${activeTab === 'gallery' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <div className={`p-1 rounded-lg transition-colors ${activeTab === 'gallery' ? 'bg-indigo-500/10' : ''}`}>
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={2}/></svg>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">Vault</span>
          </button>

          <button 
            onClick={() => setActiveTab('history')} 
            className={`flex flex-col items-center gap-1.5 group transition-all ${activeTab === 'history' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <div className={`p-1 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-indigo-500/10' : ''}`}>
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2}/></svg>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">Archive</span>
          </button>
        </div>
      </nav>

      {/* Manual Modal */}
      {showManualEntry && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-slate-800 p-8 overflow-y-auto max-h-[90vh] shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">Manual Entry</h2>
              <button onClick={() => setShowManualEntry(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-6">
               <div>
                 <label className="text-[10px] uppercase font-black text-slate-500 mb-2 block">Store Name</label>
                 <input required type="text" value={manualForm.storeName} onChange={e => setManualForm({...manualForm, storeName: e.target.value})} placeholder="e.g. Food City" className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none transition-colors" />
               </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] uppercase font-black text-slate-500 mb-2 block">Date</label>
                  <input type="date" value={manualForm.date} onChange={e => setManualForm({...manualForm, date: e.target.value})} className="w-full bg-slate-800/50 rounded-2xl px-5 py-4 border border-slate-700 outline-none" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] uppercase font-black text-slate-500 mb-2 block">Time</label>
                  <input type="time" value={manualForm.time} onChange={e => setManualForm({...manualForm, time: e.target.value})} className="w-full bg-slate-800/50 rounded-2xl px-5 py-4 border border-slate-700 outline-none" />
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl font-black text-lg shadow-xl shadow-purple-500/20 active:scale-95 transition-all">Save Bill</button>
            </form>
          </div>
        </div>
      )}

      {showScanner && <CameraScanner onCapture={handleCapture} onClose={() => setShowScanner(false)} />}
      
      {isAnalyzing && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <p className="text-lg font-black tracking-widest text-indigo-300 uppercase animate-pulse">Scanning Receipt...</p>
          <p className="text-slate-500 text-sm mt-2">Extracting data using Gemini AI</p>
        </div>
      )}
    </div>
  );
};

export default App;
