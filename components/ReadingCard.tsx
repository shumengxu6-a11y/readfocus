"use client";

import React from 'react';
import { Bookmark as BookmarkIcon, RefreshCw, Book, AlertTriangle } from 'lucide-react';
import { Bookmark, WereadError } from '@/lib/weread';
import { clsx } from 'clsx';

interface ReadingCardProps {
  bookmark: Bookmark | null;
  loading: boolean;
  error?: WereadError | null;
  onNext: () => void;
  onClose: () => void;
}

export function ReadingCard({ bookmark, loading, error, onNext, onClose }: ReadingCardProps) {
  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto bg-white p-8 rounded-2xl shadow-xl border border-slate-100 min-h-[300px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 text-slate-400">
          <RefreshCw className="animate-spin" size={32} />
          <p>Fetching inspiration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
        <div className="w-full max-w-lg mx-auto bg-white p-8 rounded-2xl shadow-xl border border-red-100 min-h-[300px] flex flex-col items-center justify-center text-center">
        <div className="bg-red-50 p-4 rounded-full mb-4">
            <AlertTriangle size={32} className="text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Connection Issue</h3>
        <p className="text-slate-500 mb-6 max-w-xs mx-auto">
            {error.details || error.message || "Failed to connect to WeChat Reading."}
        </p>
        
        {error.code === 'SESSION_EXPIRED' && (
            <div className="text-xs text-slate-400 mb-6 bg-slate-50 p-3 rounded border border-slate-200">
                Tip: Update <code className="bg-slate-200 px-1 rounded">WEREAD_COOKIE</code> in .env.local
            </div>
        )}

        <button
            onClick={onNext}
            className="px-6 py-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors"
        >
            Try Again
        </button>
        </div>
    );
  }

  if (!bookmark) {
    return (
      <div className="w-full max-w-lg mx-auto bg-white p-8 rounded-2xl shadow-xl border border-slate-100 min-h-[300px] flex flex-col items-center justify-center text-center">
        <Book size={48} className="text-slate-200 mb-4" />
        <p className="text-slate-500 mb-6">No highlights found yet.</p>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-white p-10 rounded-2xl shadow-xl border border-slate-100 min-h-[400px] flex flex-col justify-between transition-all duration-500 hover:shadow-2xl">
      <div className="space-y-6">
        <BookmarkIcon className="text-amber-500" size={32} />
        
        <blockquote className="text-xl md:text-2xl font-serif text-slate-800 leading-relaxed border-l-4 border-amber-500 pl-6 py-2">
          "{bookmark.markText}"
        </blockquote>
      </div>

        <div className="mt-8 pt-8 border-t border-slate-100 flex items-end justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 text-lg">{bookmark.title}</h3>
          <p className="text-slate-500 text-sm mt-1">{bookmark.author}</p>
          <p className="text-slate-300 text-xs mt-4">
            Highlighted on {new Date(bookmark.createTime * 1000).toLocaleDateString()}
          </p>
        </div>

        <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-colors shadow-lg hover:shadow-xl text-sm"
            >
              Back to Focus
            </button>
            <button
              onClick={onNext}
              className="p-3 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Next highlight"
            >
              <RefreshCw size={20} />
            </button>
        </div>
      </div>
    </div>
  );
}
