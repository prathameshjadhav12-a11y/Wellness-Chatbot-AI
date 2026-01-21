
import React from 'react';

interface DisclaimerProps {
  t: any;
}

const Disclaimer: React.FC<DisclaimerProps> = ({ t }) => {
  return (
    <div className="space-y-4 mb-6">
      {/* Privacy Notice */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 dark:border-emerald-600 p-4 rounded-md shadow-sm transition-colors">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide">{t.privacyTitle}</h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1 leading-relaxed">
              {t.privacyText}
            </p>
          </div>
        </div>
      </div>

      {/* Medical Disclaimer */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 dark:border-amber-600 p-4 rounded-md shadow-sm transition-colors">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-amber-600 dark:text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wide">{t.disclaimerTitle}</h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
              {t.disclaimerText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Disclaimer;
