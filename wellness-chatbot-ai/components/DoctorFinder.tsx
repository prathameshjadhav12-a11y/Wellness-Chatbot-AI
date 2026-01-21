
import React, { useState } from 'react';
import { findNearbyDoctors } from '../services/geminiService';
import { DoctorSearchResult } from '../types';

interface DoctorFinderProps {
  medicalContext: string;
  language: string;
  t: any;
}

const DoctorFinder: React.FC<DoctorFinderProps> = ({ medicalContext, language, t }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DoctorSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const handleFindDoctors = () => {
    setLoading(true);
    setError(null);
    setStatus("Requesting location access...");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setLoading(false);
      return;
    }

    // Relaxed options for better success rate
    const geoOptions = {
      enableHighAccuracy: false, // Set to false for faster, less battery-intensive, and more robust indoor location
      timeout: 20000,
      maximumAge: 300000 // Allow cached positions from last 5 mins
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          setStatus("Location found. Searching for specialists...");
          
          const data = await findNearbyDoctors(medicalContext, latitude, longitude, language);
          setResult(data);
          
          if (data.mapSources.length === 0) {
             setStatus("Note: Specific map pins weren't returned, but here are relevant search results.");
          } else {
             setStatus("");
          }
        } catch (err: any) {
          setError(err.message || "Failed to find doctors nearby.");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        let errorMsg = "Unable to retrieve your location.";
        if (err.code === 1) errorMsg = "Location access denied. Please enable permissions.";
        if (err.code === 2) errorMsg = "Location unavailable. Please check your GPS/Network.";
        if (err.code === 3) errorMsg = "Location request timed out.";
        
        setError(errorMsg);
        setLoading(false);
      },
      geoOptions
    );
  };

  // Helper to render text content
  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) return <li key={i} className="ml-4 text-slate-600 dark:text-slate-400 mb-1">{line.trim().substring(2)}</li>;
      if (line.trim() === '') return <div key={i} className="h-2" />;
      return <p key={i} className="text-slate-600 dark:text-slate-400 mb-2">{line}</p>;
    });
  };

  return (
    <div id="doctor-finder" className="mt-8 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900 p-6 animate-in fade-in slide-in-from-bottom-4 duration-700 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 flex items-center">
          <svg className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {t.findDoctor}
        </h3>
      </div>

      {!result && !loading && (
        <div>
          <p className="text-indigo-800 dark:text-indigo-300 mb-4 text-sm">
            {t.locateDesc}
          </p>
          <button
            onClick={handleFindDoctors}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {t.locateDoctorBtn}
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center space-x-3 py-4">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent"></div>
          <span className="text-indigo-800 dark:text-indigo-300 font-medium">{status || t.locating}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm border border-red-100 dark:border-red-900 mt-2">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4">
           {status && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 italic">{status}</p>}
           
           <div className="prose prose-sm prose-indigo dark:prose-invert text-slate-700 dark:text-slate-300 mb-6">
             {formatContent(result.content)}
           </div>

           {result.mapSources.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               {result.mapSources.map((source, idx) => (
                 <a 
                   key={idx}
                   href={source.uri}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="flex flex-col p-3 bg-white dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-indigo-900 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md transition-all group"
                 >
                   <div className="flex items-center mb-1">
                     <div className="bg-green-100 dark:bg-green-900/40 p-1.5 rounded-full mr-2 text-green-600 dark:text-green-400">
                       <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                         <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                       </svg>
                     </div>
                     <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm group-hover:text-indigo-700 dark:group-hover:text-indigo-400 truncate">{source.title}</span>
                   </div>
                   {source.address && <div className="text-xs text-slate-500 dark:text-slate-400 pl-8 mb-1">{source.address}</div>}
                   <div className="text-xs text-slate-500 dark:text-slate-400 pl-8 flex items-center">
                      <span>View on Google {source.address ? 'Maps' : 'Search'}</span>
                      <svg className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                   </div>
                 </a>
               ))}
             </div>
           ) : (
             <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 text-center">
               <p className="text-sm text-slate-500 dark:text-slate-400">No specific locations found on the map, but please check the recommendations above.</p>
             </div>
           )}
        </div>
      )}
    </div>
  );
};

export default DoctorFinder;
