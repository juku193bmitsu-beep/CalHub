import React from 'react';
import { useCalendar } from '../../contexts/CalendarContext';
import { ArrowThickness, ArrowPattern, ArrowHeadStyle } from '../../types/settings';
import { X, Check } from 'lucide-react';

interface ArrowStylePickerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArrowStylePicker: React.FC<ArrowStylePickerProps> = ({
  isOpen,
  onClose,
}) => {
  const { arrowSettings, updateArrowSettings } = useCalendar();

  if (!isOpen) return null;

  const thicknesses: { id: ArrowThickness; label: string; px: number }[] = [
    { id: 'thin', label: '細め (2px)', px: 2 },
    { id: 'normal', label: '標準 (3px)', px: 3 },
    { id: 'thick', label: '太め (4.5px)', px: 4.5 },
  ];

  const patterns: { id: ArrowPattern; label: string }[] = [
    { id: 'solid', label: '実線 (ソリッド)' },
    { id: 'dashed', label: '破線 (ダッシュ)' },
    { id: 'gradient', label: 'グラデーション' },
  ];

  const heads: { id: ArrowHeadStyle; label: string }[] = [
    { id: 'standard', label: '三角矢印' },
    { id: 'circle', label: '丸ノード' },
    { id: 'minimal', label: 'ミニマル' },
    { id: 'none', label: 'なし (直線)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            複数日またぎ矢印のデザイン
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Preview Box */}
        <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center relative border border-slate-200 dark:border-slate-700">
          <div className="text-center absolute top-2 left-3 text-[10px] text-slate-400 font-semibold">
            リアルタイムプレビュー
          </div>

          <svg className="w-48 h-20">
            <defs>
              <marker
                id="preview-arrowhead"
                markerWidth="8"
                markerHeight="8"
                refX="4"
                refY="4"
                orient="auto"
              >
                {arrowSettings.headStyle === 'circle' ? (
                  <circle cx="4" cy="4" r="3" fill="#3b82f6" />
                ) : arrowSettings.headStyle === 'minimal' ? (
                  <path d="M 1 1 L 4 4 L 1 7" fill="none" stroke="#3b82f6" strokeWidth="2" />
                ) : arrowSettings.headStyle === 'none' ? null : (
                  <path d="M 0 0 L 6 4 L 0 8 Z" fill="#3b82f6" />
                )}
              </marker>

              <linearGradient id="preview-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>

            <circle cx="20" cy="40" r="5" fill="#3b82f6" />
            <line
              x1="20"
              y1="40"
              x2="160"
              y2="40"
              stroke={arrowSettings.pattern === 'gradient' ? 'url(#preview-grad)' : '#3b82f6'}
              strokeWidth={
                arrowSettings.thickness === 'thin' ? 2 : arrowSettings.thickness === 'thick' ? 4.5 : 3
              }
              strokeDasharray={arrowSettings.pattern === 'dashed' ? '5 4' : undefined}
              strokeLinecap="round"
              markerEnd="url(#preview-arrowhead)"
            />
          </svg>
        </div>

        {/* Thickness Options */}
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
            太さ
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {thicknesses.map((t) => (
              <button
                key={t.id}
                onClick={() => updateArrowSettings({ thickness: t.id })}
                className={`py-2 px-2 text-xs rounded-xl font-medium border text-center transition ${
                  arrowSettings.thickness === t.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pattern Options */}
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
            パターンスタイル
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {patterns.map((p) => (
              <button
                key={p.id}
                onClick={() => updateArrowSettings({ pattern: p.id })}
                className={`py-2 px-1 text-xs rounded-xl font-medium border text-center transition ${
                  arrowSettings.pattern === p.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Arrowhead Options */}
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
            先端の形状
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {heads.map((h) => (
              <button
                key={h.id}
                onClick={() => updateArrowSettings({ headStyle: h.id })}
                className={`py-2 px-2 text-xs rounded-xl font-medium border text-center flex items-center justify-between transition ${
                  arrowSettings.headStyle === h.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>{h.label}</span>
                {arrowSettings.headStyle === h.id && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full mt-2 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-sm active:scale-98"
        >
          完了
        </button>
      </div>
    </div>
  );
};
