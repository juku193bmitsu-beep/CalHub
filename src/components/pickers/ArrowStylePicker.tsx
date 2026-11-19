import React from 'react';
import { useCalendar } from '../../contexts/CalendarContext';
import { ArrowThickness, ArrowPattern, ArrowHeadStyle } from '../../types/settings';
import { X } from 'lucide-react';

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
    { id: 'thick', label: '太め (4px)', px: 4 },
  ];

  const patterns: { id: ArrowPattern; label: string }[] = [
    { id: 'solid', label: '実線 (ソリッド)' },
    { id: 'dashed', label: '破線 (ダッシュ)' },
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
                markerWidth="3.8"
                markerHeight="3.8"
                viewBox="0 0 12 12"
                refX="10.5"
                refY="6"
                orient="auto"
                markerUnits="strokeWidth"
              >
                {arrowSettings.headStyle === 'circle' ? (
                  <circle cx="6" cy="6" r="4.5" fill="#3b82f6" />
                ) : arrowSettings.headStyle === 'minimal' ? (
                  <path d="M 2 1.5 L 10.5 6 L 2 10.5 L 4.5 6 Z" fill="#3b82f6" />
                ) : arrowSettings.headStyle === 'none' ? null : (
                  <path d="M 1.5 1 L 11 6 L 1.5 11 L 4 6 Z" fill="#3b82f6" />
                )}
              </marker>
            </defs>

            <line
              x1="20"
              y1="40"
              x2="160"
              y2="40"
              stroke="#3b82f6"
              strokeWidth={
                arrowSettings.thickness === 'thin' ? 2 : arrowSettings.thickness === 'thick' ? 4 : 2.8
              }
              strokeDasharray={
                arrowSettings.pattern === 'dashed'
                  ? `${(arrowSettings.thickness === 'thin' ? 2 : arrowSettings.thickness === 'thick' ? 4 : 2.8) * 2} ${(arrowSettings.thickness === 'thin' ? 2 : arrowSettings.thickness === 'thick' ? 4 : 2.8) * 1.5}`
                  : undefined
              }
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
          <div className="grid grid-cols-2 gap-1.5">
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
                className={`py-2 px-2 text-xs rounded-xl font-medium border text-center transition ${
                  arrowSettings.headStyle === h.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
