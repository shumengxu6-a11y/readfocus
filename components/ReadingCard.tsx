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
      <div className="glass-panel w-full max-w-lg mx-auto p-12 rounded-3xl min-h-[400px] flex flex-col items-center justify-center animate-pulse">
        <div className="flex flex-col items-center space-y-4 text-blue-200/50">
          <RefreshCw className="animate-spin" size={32} />
          <p className="tracking-widest text-xs uppercase opacity-70">Extracting Knowledge...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel w-full max-w-lg mx-auto p-10 rounded-3xl min-h-[400px] flex flex-col items-center justify-center text-center border-red-500/30">
        <div className="bg-red-500/10 p-4 rounded-full mb-6">
          <AlertTriangle size={36} className="text-red-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Sync Issue</h3>
        <p className="text-gray-400 mb-8 max-w-xs mx-auto text-sm leading-relaxed">
          {error.details || error.message || "WeChat Reading connection failed."}
        </p>

        {error.code === 'SESSION_EXPIRED' && (
          <div className="text-xs text-red-300 mb-6 bg-red-900/20 p-3 rounded border border-red-500/20 font-mono">
            Tip: Update `WEREAD_COOKIE` in .env.local
          </div>
        )}

        <button
          onClick={onNext}
          className="px-8 py-3 bg-white text-black rounded-full hover:bg-gray-200 transition-colors font-medium text-sm"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!bookmark) {
    return (
      <div className="glass-panel w-full max-w-lg mx-auto p-12 rounded-3xl min-h-[400px] flex flex-col items-center justify-center text-center">
        <Book size={48} className="text-gray-600 mb-6" />
        <p className="text-gray-400 mb-8">No specific highlights found.</p>
        <button
          onClick={onNext}
          className="px-8 py-3 bg-white text-black rounded-full hover:bg-gray-200 transition-colors font-medium text-sm"
        >
          Try Random
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel w-full max-w-lg mx-auto p-10 rounded-3xl min-h-[450px] flex flex-col justify-between transition-all duration-700 hover:shadow-2xl hover:border-white/20 fade-in slide-up">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <BookmarkIcon className="text-blue-400" size={28} />
          <span className="text-xs text-blue-200/30 font-mono uppercase tracking-widest">ReadFocus Archive</span>
        </div>

        <blockquote className="text-xl md:text-2xl font-serif text-white/90 leading-relaxed pl-2 relative">
          <span className="absolute -top-4 -left-4 text-6xl text-white/5 font-serif">“</span>
          {bookmark.markText}
          <span className="absolute -bottom-10 right-0 text-6xl text-white/5 font-serif">”</span>
        </blockquote>
      </div>

      <div className="mt-12 pt-8 border-t border-white/5 flex items-end justify-between">
        <div>
          <h3 className="font-semibold text-white/90 text-lg tracking-tight">{bookmark.title}</h3>
          <p className="text-gray-400 text-sm mt-1">{bookmark.author}</p>
          <p className="text-gray-600 text-xs mt-3 font-mono">
            {new Date(bookmark.createTime * 1000).toLocaleDateString()}
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all text-sm border border-white/5 backdrop-blur-md"
          >
            Focus
          </button>
          <button
            onClick={onNext}
            className="p-2.5 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/50"
            aria-label="Next highlight"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
