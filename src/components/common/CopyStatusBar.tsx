import React from 'react';
import { useClipboard } from '../../contexts/ClipboardContext';
import { Copy, X } from 'lucide-react';

export const CopyStatusBar: React.FC = () => {
  const { copiedEvent, clearClipboard } = useClipboard();

  if (!copiedEvent) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-14 inset-x-3 z-40 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="pointer-events-auto bg-slate-900/95 dark:bg-slate-800/95 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700/60 max-w-md w-full justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Copy className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">
              コピー中:「{copiedEvent.summary}」
            </p>
            <p className="text-[10px] text-slate-300">
              貼り付けたい日付をタップで即時作成（連続可）
            </p>
          </div>
        </div>

        <button
          onClick={clearClipboard}
          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-medium flex items-center gap-1 transition active:scale-95 shrink-0 text-slate-200"
        >
          <X className="w-3.5 h-3.5" />
          <span>終了</span>
        </button>
      </div>
    </div>
  );
};
