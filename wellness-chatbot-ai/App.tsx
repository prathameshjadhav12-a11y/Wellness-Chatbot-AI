
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Disclaimer from './components/Disclaimer';
import ResultView from './components/ResultView';
import DoctorFinder from './components/DoctorFinder';
import { analyzeSymptoms } from './services/geminiService';
import { AnalysisResult, HistoryItem, Vitals, LocalAnalysis, TrendInsight } from './types';
import { getTranslation, LANGUAGE_CODES } from './utils/translations';

const LANGUAGES = Object.keys(LANGUAGE_CODES);

interface ImageState {
  data: string;
  mimeType: string;
}

const App: React.FC = () => {
  const [symptoms, setSymptoms] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Theme State
  const [darkMode, setDarkMode] = useState(false);

  // New States
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [selectedImage, setSelectedImage] = useState<ImageState | null>(null);
  const [vitals, setVitals] = useState<Vitals>({ temp: '', hr: '', bpSys: '', bpDia: '', spo2: '' });
  const [localAnalysis, setLocalAnalysis] = useState<LocalAnalysis[]>([]);
  const [trendInsights, setTrendInsights] = useState<TrendInsight[]>([]);
  const [isListening, setIsListening] = useState(false);
  
  // Outbreak Alert State
  const [outbreakAlert, setOutbreakAlert] = useState<{message: string; location: string} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Translation Helper
  const t = getTranslation(selectedLanguage);

  // Initialize Theme
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  // Apply Theme Class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('healthlens_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Edge Computing: Local Analysis of Vitals
  useEffect(() => {
    const alerts: LocalAnalysis[] = [];
    
    // Fever Check
    if (vitals.temp) {
      const temp = parseFloat(vitals.temp);
      if (temp > 103) alerts.push({ condition: 'High Fever', severity: 'critical', message: 'Medical attention recommended immediately.' });
      else if (temp > 100.4) alerts.push({ condition: 'Fever', severity: 'warning', message: 'Monitor temperature closely.' });
      else if (temp < 95) alerts.push({ condition: 'Hypothermia Risk', severity: 'critical', message: 'Body temperature is dangerously low.' });
      else alerts.push({ condition: 'Temperature', severity: 'normal', message: 'Within normal range.' });
    }

    // Heart Rate Check
    if (vitals.hr) {
      const hr = parseInt(vitals.hr);
      if (hr > 120) alerts.push({ condition: 'Tachycardia', severity: 'critical', message: 'Heart rate is significantly high.' });
      else if (hr > 100) alerts.push({ condition: 'Elevated HR', severity: 'warning', message: 'Heart rate is above normal.' });
      else if (hr < 50) alerts.push({ condition: 'Bradycardia', severity: 'warning', message: 'Heart rate is lower than normal.' });
      else alerts.push({ condition: 'Heart Rate', severity: 'normal', message: 'Normal resting heart rate.' });
    }

    // Blood Pressure Check
    if (vitals.bpSys && vitals.bpDia) {
      const sys = parseInt(vitals.bpSys);
      const dia = parseInt(vitals.bpDia);
      if (sys > 180 || dia > 120) alerts.push({ condition: 'Hypertensive Crisis', severity: 'critical', message: 'Seek emergency care immediately.' });
      else if (sys > 140 || dia > 90) alerts.push({ condition: 'High BP', severity: 'warning', message: 'Stage 2 Hypertension range.' });
      else if (sys > 130 || dia > 80) alerts.push({ condition: 'Elevated BP', severity: 'warning', message: 'Stage 1 Hypertension range.' });
      else alerts.push({ condition: 'Blood Pressure', severity: 'normal', message: 'Normal healthy range.' });
    }
    
    // SpO2 Check
    if (vitals.spo2) {
      const spo2 = parseInt(vitals.spo2);
      if (spo2 < 90) alerts.push({ condition: 'Hypoxia Risk', severity: 'critical', message: 'Oxygen levels are dangerously low.' });
      else if (spo2 < 95) alerts.push({ condition: 'Low Oxygen', severity: 'warning', message: 'Oxygen saturation is below optimal.' });
      else alerts.push({ condition: 'Oxygen Level', severity: 'normal', message: 'Normal saturation.' });
    }

    setLocalAnalysis(alerts);
  }, [vitals]);

  // Chronic Disease Trend Analysis Logic
  const calculateTrends = (currentVitals: Vitals, historyData: HistoryItem[]) => {
    const insights: TrendInsight[] = [];
    const recentHistory = historyData.filter(h => h.vitals).slice(0, 5); // Look at last 5 entries

    if (recentHistory.length === 0) return insights;

    // Heart Rate Trend
    if (currentVitals.hr) {
      const currentHR = parseInt(currentVitals.hr);
      const avgHR = recentHistory.reduce((acc, curr) => acc + (parseInt(curr.vitals?.hr || '0') || 0), 0) / recentHistory.filter(h => h.vitals?.hr).length;
      
      if (avgHR > 0) {
        const diff = currentHR - avgHR;
        const percentChange = (diff / avgHR) * 100;
        
        if (Math.abs(percentChange) > 10) {
          insights.push({
            metric: 'Heart Rate',
            change: `${Math.abs(Math.round(percentChange))}%`,
            direction: percentChange > 0 ? 'up' : 'down',
            message: percentChange > 0 
              ? 'Significant increase compared to your recent average. Monitor for fatigue.' 
              : 'Lower than your recent average.'
          });
        }
      }
    }

    // Weight/Temp/BP could be added similarly
    return insights;
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    // Dynamically set language for voice recognition
    recognition.lang = LANGUAGE_CODES[selectedLanguage] || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSymptoms(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        setSelectedImage({
          data: base64Data,
          mimeType: file.type || 'image/jpeg'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const checkOutbreaks = () => {
    if (!navigator.geolocation) return;

    // Simulate Geo-Fencing check
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      // In a real app, we would send lat/lng to a backend outbreak database
      // Here we simulate an alert for demonstration
      
      // Determine random "outbreak" for demo if permissions granted
      const demoOutbreaks = [
        { loc: "your area", msg: "High Dengue risk reported in your area. multiple cases flagged in the last 48h." },
        { loc: "your area", msg: "Viral Flu outbreak detected nearby. Recommend masking in crowded places." }
      ];
      
      const randomAlert = demoOutbreaks[Math.floor(Math.random() * demoOutbreaks.length)];
      setOutbreakAlert({
        location: `Lat: ${latitude.toFixed(2)}, Lng: ${longitude.toFixed(2)}`,
        message: randomAlert.msg
      });
    }, (err) => {
      console.log("Location denied for outbreak check");
    });
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptoms.trim() && !selectedImage && !Object.values(vitals).some(v => v)) return;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setTrendInsights([]);

    try {
      // Calculate trends before saving new history
      const trends = calculateTrends(vitals, history);
      setTrendInsights(trends);

      const data = await analyzeSymptoms(symptoms, selectedImage, vitals, selectedLanguage);
      setResult(data);
      
      const newHistoryItem: HistoryItem = {
        id: crypto.randomUUID(),
        symptoms: symptoms || (selectedImage ? '[Image Scan Analysis]' : '[Vitals Analysis]'),
        timestamp: Date.now(),
        result: data,
        vitals: vitals // Save vitals for future trend analysis
      };
      
      const updatedHistory = [newHistoryItem, ...history].slice(0, 10);
      setHistory(updatedHistory);
      localStorage.setItem('healthlens_history', JSON.stringify(updatedHistory));
      
      // Trigger outbreak check on analysis
      checkOutbreaks();

    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('healthlens_history');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-300">
      {/* Navigation / Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{t.appTitle}</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-widest">{t.subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <div className="relative">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="appearance-none bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-colors"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>

            <nav className="hidden sm:flex space-x-6">
              <button 
                onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                {t.history}
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Disclaimer t={t} />

        {/* Geo-Fencing Outbreak Alert Banner */}
        {outbreakAlert && (
          <div className="mb-6 bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 text-orange-800 dark:text-orange-200 p-4 rounded-r shadow-md flex items-start animate-in fade-in slide-in-from-top-2">
            <svg className="w-6 h-6 mr-3 text-orange-600 dark:text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="font-bold text-sm uppercase">{t.localAlertTitle}</h4>
              <p className="text-sm mt-1">{outbreakAlert.message}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 opacity-75">Geo-Fencing Active near {outbreakAlert.location}</p>
            </div>
            <button onClick={() => setOutbreakAlert(null)} className="ml-auto text-orange-400 hover:text-orange-600">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {/* Search Section */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-8 mb-8 transition-colors duration-300">
          <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t.checkSymptoms}</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">{t.descPlaceholder}</p>
            </div>
          </div>

          <form onSubmit={handleAnalyze} className="space-y-6">
            
            {/* Symptoms Input & Voice */}
            <div className="relative">
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder={t.textAreaPlaceholder}
                className="w-full h-32 p-4 pr-12 rounded-xl border border-slate-700 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none text-slate-200 placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`absolute right-4 bottom-4 p-2 rounded-full transition-all ${
                  isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-700 dark:bg-slate-700 text-slate-400 hover:text-white'
                }`}
                title="Voice Input"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            </div>

            {/* Vitals Entry (Manual) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                 <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center">
                   <svg className="w-4 h-4 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                   </svg>
                   {t.vitalSigns}
                 </h3>
                 {localAnalysis.length > 0 && (
                   <div className="flex gap-2">
                     {localAnalysis.map((alert, idx) => (
                       <span key={idx} className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                         alert.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' : 
                         alert.severity === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                         'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                       }`}>
                         {alert.condition}: {alert.severity === 'normal' ? 'Normal' : alert.severity.toUpperCase()}
                       </span>
                     ))}
                   </div>
                 )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="relative">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t.temp}</label>
                  <input 
                    type="number" 
                    placeholder="98.6"
                    value={vitals.temp}
                    onChange={(e) => setVitals({...vitals, temp: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t.hr}</label>
                  <input 
                    type="number" 
                    placeholder="72"
                    value={vitals.hr}
                    onChange={(e) => setVitals({...vitals, hr: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t.bp}</label>
                  <div className="flex gap-1">
                    <input 
                      type="number" 
                      placeholder="120"
                      value={vitals.bpSys}
                      onChange={(e) => setVitals({...vitals, bpSys: e.target.value})}
                      className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                    <span className="text-slate-400 dark:text-slate-600 py-2">/</span>
                    <input 
                      type="number" 
                      placeholder="80"
                      value={vitals.bpDia}
                      onChange={(e) => setVitals({...vitals, bpDia: e.target.value})}
                      className="w-full px-2 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t.spo2}</label>
                  <input 
                    type="number" 
                    placeholder="98"
                    value={vitals.spo2}
                    onChange={(e) => setVitals({...vitals, spo2: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              {/* Edge Computing Visual Indicator */}
              {localAnalysis.some(a => a.severity !== 'normal') && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 rounded-lg">
                   <h4 className="text-xs font-bold text-amber-800 dark:text-amber-500 uppercase mb-1">Local Analysis Insights</h4>
                   <ul className="space-y-1">
                     {localAnalysis.filter(a => a.severity !== 'normal').map((alert, i) => (
                       <li key={i} className="text-xs text-amber-900 dark:text-amber-400 flex items-start">
                         <span className="mr-2">•</span>
                         {alert.message}
                       </li>
                     ))}
                   </ul>
                </div>
              )}
            </div>

            {/* Instant Scan / Image Upload Area */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                {!selectedImage ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="h-16 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex items-center justify-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all group"
                  >
                    <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      <div className="flex items-center">
                        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-semibold text-sm">{t.instantScan}</span>
                      </div>
                      <span className="text-[10px] mt-1 text-slate-400 dark:text-slate-500 flex items-center">
                         <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                         {t.processedLocally}
                      </span>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload}
                    />
                  </div>
                ) : (
                  <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between px-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-slate-300 dark:bg-slate-600 rounded overflow-hidden mr-3">
                        <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{t.imageAttached}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={removeImage}
                      className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isAnalyzing || (!symptoms.trim() && !selectedImage && !Object.values(vitals).some(v => v))}
                className={`
                  sm:w-auto w-full px-8 h-16 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center shrink-0
                  ${isAnalyzing || (!symptoms.trim() && !selectedImage && !Object.values(vitals).some(v => v))
                    ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 active:transform active:scale-95 shadow-indigo-100 dark:shadow-none'}
                `}
              >
                {isAnalyzing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t.scanning}
                  </>
                ) : (
                  <>
                    {t.runAnalysis}
                    <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl mb-8 flex items-center transition-colors">
            <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Loading Skeleton */}
        {isAnalyzing && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 animate-pulse transition-colors">
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-3/4 mb-4"></div>
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-1/2 mb-8"></div>
            <div className="space-y-3">
              <div className="h-3 bg-slate-50 dark:bg-slate-800 rounded-full w-full"></div>
              <div className="h-3 bg-slate-50 dark:bg-slate-800 rounded-full w-full"></div>
              <div className="h-3 bg-slate-50 dark:bg-slate-800 rounded-full w-2/3"></div>
            </div>
          </div>
        )}

        {/* Result Section */}
        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Trend Analysis Card */}
            {trendInsights.length > 0 && (
              <div className="mb-6 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl p-5">
                <h3 className="text-lg font-bold text-purple-900 dark:text-purple-100 flex items-center mb-3">
                   <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                   {t.trendTitle}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {trendInsights.map((insight, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-purple-100 dark:border-slate-700">
                       <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{insight.metric}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${insight.direction === 'up' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                            {insight.change}
                          </span>
                       </div>
                       <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{insight.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <ResultView result={result} t={t} />
            <DoctorFinder medicalContext={result.content} language={selectedLanguage} t={t} />
          </div>
        )}

        {/* History Section */}
        {history.length > 0 && (
          <section className="mt-16 pb-12">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{t.recentChecks}</h3>
              <button 
                onClick={clearHistory}
                className="text-sm font-medium text-slate-400 hover:text-red-500 transition-colors"
              >
                {t.clearHistory}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setResult(item.result);
                    setSymptoms(item.symptoms);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all text-left group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium text-slate-400">
                      {new Date(item.timestamp).toLocaleDateString()} at {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 font-medium line-clamp-2 italic">"{item.symptoms}"</p>
                  {item.result.confidence && (
                    <div className="mt-2 flex items-center">
                       <div className="h-1 w-16 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                         <div className="h-full bg-indigo-500" style={{width: `${item.result.confidence.score}%`}}></div>
                       </div>
                       <span className="ml-2 text-[10px] text-slate-400 font-bold uppercase">{item.result.confidence.label} Conf.</span>
                    </div>
                  )}
                  {item.vitals && item.vitals.hr && (
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">HR: {item.vitals.hr}</span>
                      {item.vitals.temp && <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Temp: {item.vitals.temp}°</span>}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 text-slate-400 py-12 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg">{t.appTitle}</span>
          </div>
          <p className="text-sm mb-4 max-w-lg mx-auto">
            Empowering individuals with intelligent, grounded health information. Always consult a medical professional for clinical diagnosis.
          </p>
          <div className="flex justify-center space-x-8 text-xs uppercase tracking-widest font-bold">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <p className="mt-8 text-[10px] text-slate-600 dark:text-slate-500">
            © {new Date().getFullYear()} Wellness Chatbot AI. Powered by Gemini.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
