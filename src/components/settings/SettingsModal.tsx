import React, { useState, useEffect } from 'react';
import { useCalendar } from '../../contexts/CalendarContext';
import { useEvents } from '../../contexts/EventContext';
import { googleAuth } from '../../services/googleAuth';
import {
  ArrowThickness,
  ArrowPattern,
  ArrowHeadStyle,
  EventDisplayStyle,
  VerticalFontSize,
  VerticalFontWeight,
  MonthlyFontSize,
  MonthlyFontWeight,
} from '../../types/settings';
import {
  X,
  Check,
  Calendar as CalendarIcon,
  Sliders,
  Globe,
  LogIn,
  LogOut,
  HelpCircle,
  ExternalLink,
  Sun,
  Moon,
  Trash2,
  RotateCcw,
  Palette,
  Type,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { TEXT_COLOR_PRESETS, BG_COLOR_PRESETS } from '../../services/colorUtils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'calendars' | 'google' | 'arrows';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'calendars',
}) => {
  const {
    calendars,
    visibleCalendarIds,
    toggleCalendarVisibility,
    setAllCalendarsVisible,
    arrowSettings,
    updateArrowSettings,
    allDayEventStyle,
    setAllDayEventStyle,
    timedEventStyle,
    setTimedEventStyle,
    verticalFontSize,
    setVerticalFontSize,
    verticalFontWeight,
    setVerticalFontWeight,
    monthlyFontSize,
    setMonthlyFontSize,
    monthlyFontWeight,
    setMonthlyFontWeight,
    authToken,
    setAuthToken,
    theme,
    toggleTheme,
    updateCalendarColor,
  } = useCalendar();

  const { clearAllEvents, resetToMockEvents, refreshEvents, eventStats, isSyncingEvents } = useEvents();

  const [activeTab, setActiveTab] = useState<'calendars' | 'google' | 'arrows'>(initialTab);
  const [clientIdInput, setClientIdInput] = useState(googleAuth.getClientId());
  const [isSavedClientNotice, setIsSavedClientNotice] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [editingCalId, setEditingCalId] = useState<string | null>(null);

  // Sync tab & clientId when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setClientIdInput(googleAuth.getClientId());
      setIsSavedClientNotice(false);
      setLoginError(null);
    }
  }, [isOpen, initialTab]);

  // Escape key listener to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isAllSelected = calendars.every((c) => visibleCalendarIds.has(c.id));
  const isConfigured = googleAuth.isConfigured();

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    googleAuth.setClientId(clientIdInput.trim());
    setIsSavedClientNotice(true);
    setTimeout(() => setIsSavedClientNotice(false), 2500);
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      // Force account selection to ensure fresh, uncorrupted access token
      const token = await googleAuth.requestToken('select_account');
      setAuthToken(token);
    } catch (err: any) {
      console.error('Google login failed:', err);
      setLoginError(err?.message || 'Googleログインに失敗しました。Client IDの設定を確認してください。');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = () => {
    setAuthToken(null);
    try {
      localStorage.removeItem('calhub_auth_bar_dismissed_v1');
    } catch {}
  };

  const handleClearDemoData = () => {
    if (window.confirm('現在のすべての予定を消去し、白紙のカレンダーにしますか？（ご自身の予定だけを入力して本番利用したい場合に便利です）')) {
      clearAllEvents();
      alert('予定をすべて消去しました。新しい予定を入力してご利用ください。');
    }
  };

  const handleResetDemoData = () => {
    if (window.confirm('初期サンプル予定（出張・レビュー定例・旅行など）を再読み込みしますか？')) {
      resetToMockEvents();
      alert('サンプル予定を復元しました。');
    }
  };

  const thicknesses: { id: ArrowThickness; label: string }[] = [
    { id: 'thin', label: '細め (2px)' },
    { id: 'normal', label: '標準 (3px)' },
    { id: 'thick', label: '太め (4px)' },
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

  const fontSizes: { id: VerticalFontSize; label: string; shortLabel: string }[] = [
    { id: 'xsmall', label: '極小', shortLabel: '極小' },
    { id: 'small', label: '小', shortLabel: '小' },
    { id: 'normal', label: '標準', shortLabel: '標準' },
    { id: 'medium', label: '中大', shortLabel: '中大' },
    { id: 'large', label: '大 (推奨)', shortLabel: '大' },
    { id: 'xlarge', label: '特大', shortLabel: '特大' },
    { id: 'huge', label: '極大', shortLabel: '極大' },
  ];

  const fontWeights: { id: VerticalFontWeight; label: string }[] = [
    { id: 'normal', label: '通常' },
    { id: 'bold', label: '太字 (推奨)' },
    { id: 'extrabold', label: '極太' },
  ];

  const allDayStyles: { id: EventDisplayStyle; label: string; desc: string }[] = [
    { id: 'filled', label: '濃い (推奨)', desc: '濃い背景に白文字' },
    { id: 'underbar', label: 'アンダーライン', desc: '黒文字に下線' },
    { id: 'none', label: '何もなし', desc: 'ドットと文字のみ' },
  ];

  const timedStyles: { id: EventDisplayStyle; label: string; desc: string }[] = [
    { id: 'underbar', label: 'アンダーライン (推奨)', desc: '黒文字に下線' },
    { id: 'filled', label: '濃い', desc: '濃い背景に白文字' },
    { id: 'none', label: '何もなし', desc: 'ドットと文字のみ' },
  ];

  const monthlyFontSizes: { id: MonthlyFontSize; label: string; desc: string }[] = [
    { id: 'small', label: '小', desc: 'コンパクト' },
    { id: 'normal', label: '標準', desc: '標準サイズ' },
    { id: 'large', label: '大 (推奨)', desc: '見やすく快適' },
    { id: 'xlarge', label: '特大', desc: '最大サイズ' },
  ];

  const monthlyFontWeights: { id: MonthlyFontWeight; label: string }[] = [
    { id: 'normal', label: '通常' },
    { id: 'bold', label: '太字 (推奨)' },
    { id: 'extrabold', label: '極太' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92dvh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                設定
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                表示カテゴリー・Google連携・矢印デザイン・外観テーマ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition active:scale-95 border border-slate-200/60 dark:border-slate-700 shadow-2xs"
              title="ライト / ダークモード切り替え"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>ライト</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span>ダーク</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Segmented Control (3 Tabs) */}
        <div className="px-5 pt-3 shrink-0">
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
            <button
              onClick={() => setActiveTab('calendars')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                activeTab === 'calendars'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>カテゴリー</span>
            </button>
            <button
              onClick={() => setActiveTab('google')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                activeTab === 'google'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Google連携</span>
            </button>
            <button
              onClick={() => setActiveTab('arrows')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                activeTab === 'arrows'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>デザイン・表示</span>
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: CALENDARS CATEGORY VISIBILITY */}
          {activeTab === 'calendars' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  表示するカレンダー
                </span>
                <button
                  type="button"
                  onClick={() => setAllCalendarsVisible(!isAllSelected)}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {isAllSelected ? 'すべて解除' : 'すべて選択'}
                </button>
              </div>

              <div className="space-y-2">
                {calendars.map((cal) => {
                  const isChecked = visibleCalendarIds.has(cal.id);
                  const isEditingThis = editingCalId === cal.id;

                  return (
                    <div
                      key={cal.id}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        isChecked
                          ? 'border-blue-400/80 bg-white dark:bg-slate-900 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-70'
                      }`}
                    >
                      {/* Main Category Row */}
                      <div className="flex items-center justify-between p-3 gap-2">
                        <div
                          onClick={() => toggleCalendarVisibility(cal.id)}
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/10"
                            style={{ backgroundColor: cal.backgroundColor }}
                          />
                          <span
                            className={`text-sm font-semibold truncate ${
                              isChecked
                                ? 'text-slate-800 dark:text-slate-100'
                                : 'text-slate-400 line-through'
                            }`}
                          >
                            {cal.summary}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Color Customization Toggle */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCalId(isEditingThis ? null : cal.id);
                            }}
                            className={`px-2 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1 transition active:scale-95 ${
                              isEditingThis
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                            }`}
                            title="カレンダー色と文字色を変更"
                          >
                            <Palette className="w-3.5 h-3.5" />
                            <span className="text-[11px] hidden sm:inline">色変更</span>
                            {isEditingThis ? (
                              <ChevronUp className="w-3 h-3 ml-0.5" />
                            ) : (
                              <ChevronDown className="w-3 h-3 ml-0.5" />
                            )}
                          </button>

                          {/* Custom Checkbox Toggle */}
                          <div
                            onClick={() => toggleCalendarVisibility(cal.id)}
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                              isChecked
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      </div>

                      {/* Expandable Color Palette for this category */}
                      {isEditingThis && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-slate-700/80 space-y-3 animate-in fade-in">
                          {/* 1. Category Default Text Color */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5 flex items-center gap-1">
                              <Type className="w-3 h-3 text-slate-500" />
                              このカテゴリーの文字色
                            </label>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {TEXT_COLOR_PRESETS.map((p) => {
                                const isFgSel = (cal.customTextColor || 'auto') === p.value;
                                if (p.value === 'auto') {
                                  return (
                                    <button
                                      key="auto"
                                      type="button"
                                      onClick={() =>
                                        updateCalendarColor(cal.id, { customTextColor: 'auto' })
                                      }
                                      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                                        isFgSel
                                          ? 'bg-blue-600 text-white border-blue-600 ring-1 ring-blue-400'
                                          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                                      }`}
                                    >
                                      自動
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    key={p.value}
                                    type="button"
                                    onClick={() =>
                                      updateCalendarColor(cal.id, { customTextColor: p.value })
                                    }
                                    title={p.label}
                                    className={`w-5 h-5 rounded-full border transition active:scale-95 ${
                                      isFgSel
                                        ? 'ring-2 ring-blue-500 scale-110'
                                        : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: p.bgHex }}
                                  />
                                );
                              })}

                              {/* Custom HTML Color Picker for Text */}
                              <label
                                title="カスタム文字色"
                                className="relative w-5 h-5 rounded-full border border-dashed border-slate-400 dark:border-slate-500 flex items-center justify-center cursor-pointer text-[9px] font-bold text-slate-500 hover:text-blue-500"
                              >
                                +
                                <input
                                  type="color"
                                  value={
                                    cal.customTextColor && cal.customTextColor !== 'auto'
                                      ? cal.customTextColor
                                      : '#000000'
                                  }
                                  onChange={(e) =>
                                    updateCalendarColor(cal.id, { customTextColor: e.target.value })
                                  }
                                  className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                                />
                              </label>
                            </div>
                          </div>

                          {/* 2. Category Background Color */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5 flex items-center gap-1">
                              <Palette className="w-3 h-3 text-slate-500" />
                              カテゴリーの背景色
                            </label>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {BG_COLOR_PRESETS.map((p) => {
                                const isBgSel = cal.backgroundColor === p.value;
                                return (
                                  <button
                                    key={p.value}
                                    type="button"
                                    onClick={() =>
                                      updateCalendarColor(cal.id, { backgroundColor: p.value })
                                    }
                                    title={p.label}
                                    className={`w-5 h-5 rounded-full border transition active:scale-95 ${
                                      isBgSel
                                        ? 'ring-2 ring-blue-500 scale-110'
                                        : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: p.bgHex }}
                                  />
                                );
                              })}

                              {/* Custom HTML Color Picker for Background */}
                              <label
                                title="カスタム背景色"
                                className="relative w-5 h-5 rounded-full border border-dashed border-slate-400 dark:border-slate-500 flex items-center justify-center cursor-pointer text-[9px] font-bold text-slate-500 hover:text-blue-500"
                              >
                                +
                                <input
                                  type="color"
                                  value={cal.backgroundColor || '#039be5'}
                                  onChange={(e) =>
                                    updateCalendarColor(cal.id, { backgroundColor: e.target.value })
                                  }
                                  className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-1 leading-relaxed">
                ※ チェックを外したカレンダーの予定は非表示になります。表の画面を広く保ちながらいつでも切り替えが可能です。
              </p>
            </div>
          )}

          {/* TAB 2: GOOGLE CALENDAR SYNC & LOCAL DATA */}
          {activeTab === 'google' && (
            <div className="space-y-4">
              {/* Connection Status Card */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          authToken
                            ? 'bg-emerald-500 animate-pulse'
                            : isConfigured
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {authToken
                          ? 'Googleカレンダー接続中'
                          : isConfigured
                          ? 'Client ID 設定済み（未接続 / 期限切れ）'
                          : 'デモモード（ローカル保存中）'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {authToken
                        ? 'Googleカレンダーと安全に同期されています'
                        : isConfigured
                        ? 'Googleログインを押すとご自身のカレンダーと接続・同期されます'
                        : 'Client ID を入力するとGoogleカレンダーと双方向同期できます'}
                    </p>
                  </div>

                  {authToken ? (
                    <button
                      type="button"
                      onClick={handleGoogleLogout}
                      className="px-2.5 py-1.5 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1 transition shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>ログアウト</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoggingIn || !isConfigured}
                      className={`px-3 py-1.5 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-xs ${
                        isConfigured
                          ? 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                          : 'bg-slate-400 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>{isLoggingIn ? '認証中...' : 'Googleログイン'}</span>
                    </button>
                  )}
                </div>

                {/* Stored Events Statistics & Resync Action */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">端末内キャッシュ: </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {eventStats.total.toLocaleString()} 件
                      </span>
                      {eventStats.minYear && eventStats.maxYear && (
                        <span className="text-slate-500 dark:text-slate-400 ml-1">
                          ({eventStats.minYear}年〜{eventStats.maxYear}年)
                        </span>
                      )}
                    </div>

                    {authToken && (
                      <button
                        type="button"
                        disabled={isSyncingEvents}
                        onClick={() => {
                          refreshEvents();
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs shrink-0 cursor-pointer"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isSyncingEvents ? 'animate-spin' : ''}`} />
                        <span>{isSyncingEvents ? '全期間同期中...' : '過去10年〜未来3年を一括同期'}</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                    💡 カレンダーをめくると、その年月の予定は自動的にバックグラウンドで即時取得されます。オフラインでも過去・未来の全予定を見たい場合は「一括同期」を実行してください。
                  </p>
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
                  {loginError}
                </div>
              )}

              {/* Client ID Setting Form */}
              <form onSubmit={handleSaveClientId} className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Google OAuth クライアント ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="xxxx.apps.googleusercontent.com"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold transition active:scale-95 shrink-0"
                  >
                    保存
                  </button>
                </div>
                {isSavedClientNotice && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    クライアントIDを保存しました。「Googleログイン」から接続できます。
                  </p>
                )}
              </form>

              {/* Step-by-Step Setup Guide Accordion */}
              <div className="p-3.5 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold text-xs">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span>Google Cloud Console 設定手順（約2分）</span>
                </div>
                <ol className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed pl-1">
                  <li>
                    <a
                      href="https://console.cloud.google.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 underline font-medium inline-flex items-center gap-0.5"
                    >
                      Google Cloud Console <ExternalLink className="w-3 h-3" />
                    </a>
                    で新規プロジェクトを作成
                  </li>
                  <li>「APIとサービス」→「ライブラリ」から <strong>Google Calendar API</strong> を有効化</li>
                  <li>
                    「認証情報」→「認証情報を作成」→ <strong>OAuth 2.0 クライアント ID</strong>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-3 pt-0.5">
                      ・種類: <strong>ウェブ アプリケーション</strong><br />
                      ・承認済みの JavaScript 生成元: <code className="bg-white/80 dark:bg-slate-800 px-1 rounded font-mono">http://localhost:5173</code>
                    </div>
                  </li>
                  <li>作成されたクライアントID（.apps.googleusercontent.com）を上の入力欄に貼り付けて「保存」</li>
                </ol>
              </div>

              {/* Local Storage & Reset Options */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  ローカルデータの管理（オフライン・個人利用）
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearDemoData}
                    className="flex-1 py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-rose-100 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>デモデータを空にする（本番開始）</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDemoData}
                    className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-100 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>サンプル復元</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ARROW & VIEW STYLES */}
          {activeTab === 'arrows' && (
            <div className="space-y-4">
              {/* All-Day Events Style: 濃い | アンダーライン | 何もなし */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    終日・連日予定の表示スタイル
                  </label>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                    基本: 濃い（白文字）
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {allDayStyles.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setAllDayEventStyle(style.id)}
                      className={`p-2.5 rounded-2xl border text-left transition flex flex-col gap-1.5 cursor-pointer ${
                        allDayEventStyle === style.id
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold shadow-2xs ring-1 ring-blue-400/50'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="text-xs font-bold">{style.label}</span>
                      {style.id === 'filled' ? (
                        <div className="px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] truncate font-medium shadow-2xs">
                          終日出張
                        </div>
                      ) : style.id === 'underbar' ? (
                        <div className="px-1 py-0.5 border-b-[2.5px] border-blue-500 text-[10px] text-slate-800 dark:text-slate-100 truncate font-medium">
                          終日出張
                        </div>
                      ) : (
                        <div className="px-1 py-0.5 flex items-center gap-1 text-[10px] text-slate-800 dark:text-slate-100 truncate font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                          <span>終日出張</span>
                        </div>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {style.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timed Events Style: アンダーライン | 濃い | 何もなし */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    時間指定予定の表示スタイル
                  </label>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                    基本: アンダーライン
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {timedStyles.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setTimedEventStyle(style.id)}
                      className={`p-2.5 rounded-2xl border text-left transition flex flex-col gap-1.5 cursor-pointer ${
                        timedEventStyle === style.id
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold shadow-2xs ring-1 ring-blue-400/50'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="text-xs font-bold">{style.label}</span>
                      {style.id === 'underbar' ? (
                        <div className="px-1 py-0.5 border-b-[2.5px] border-blue-500 text-[10px] text-slate-800 dark:text-slate-100 truncate font-medium">
                          10:00 会議
                        </div>
                      ) : style.id === 'filled' ? (
                        <div className="px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] truncate font-medium shadow-2xs">
                          10:00 会議
                        </div>
                      ) : (
                        <div className="px-1 py-0.5 flex items-center gap-1 text-[10px] text-slate-800 dark:text-slate-100 truncate font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          <span>10:00 会議</span>
                        </div>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {style.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vertical Typography: Font Size & Weight Customization */}
              <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    縦型カレンダーの文字設定（日にち・曜日・予定）
                  </span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-100/70 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                    行の高さは維持
                  </span>
                </div>

                {/* Typography Live Preview */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-end gap-2">
                  <div className="flex items-baseline gap-1 shrink-0 pb-[1px]">
                    <span
                      className={`tabular-nums leading-none font-black text-blue-600 dark:text-blue-400 ${
                        verticalFontSize === 'huge'
                          ? 'text-[16px]'
                          : verticalFontSize === 'xlarge'
                          ? 'text-[15px]'
                          : verticalFontSize === 'large'
                          ? 'text-[14px]'
                          : verticalFontSize === 'medium'
                          ? 'text-[13px]'
                          : verticalFontSize === 'normal'
                          ? 'text-xs'
                          : verticalFontSize === 'small'
                          ? 'text-[11px]'
                          : 'text-[10px]'
                      }`}
                    >
                      19
                    </span>
                    <span
                      className={`leading-none ${
                        verticalFontSize === 'huge'
                          ? 'text-[14px]'
                          : verticalFontSize === 'xlarge'
                          ? 'text-[13px]'
                          : verticalFontSize === 'large'
                          ? 'text-xs'
                          : verticalFontSize === 'medium'
                          ? 'text-[11.5px]'
                          : verticalFontSize === 'normal'
                          ? 'text-[11px]'
                          : verticalFontSize === 'small'
                          ? 'text-[10px]'
                          : 'text-[9px]'
                      } ${
                        verticalFontWeight === 'extrabold'
                          ? 'font-black'
                          : verticalFontWeight === 'bold'
                          ? 'font-bold'
                          : 'font-medium'
                      } text-slate-700 dark:text-slate-300`}
                    >
                      木
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    {/* 終日予定プレビュー */}
                    <div
                      style={
                        allDayEventStyle === 'underbar'
                          ? { borderBottom: '2.5px solid #3b82f6', backgroundColor: 'transparent' }
                          : allDayEventStyle === 'none'
                          ? { backgroundColor: 'transparent' }
                          : { backgroundColor: '#3b82f6' }
                      }
                      className={`h-[20px] px-2 flex items-center gap-1 overflow-hidden ${
                        allDayEventStyle === 'underbar'
                          ? 'border-b-[2.5px] border-blue-500 text-slate-800 dark:text-slate-100 rounded-none'
                          : allDayEventStyle === 'none'
                          ? 'text-slate-800 dark:text-slate-100'
                          : 'rounded-md text-white shadow-2xs'
                      }`}
                    >
                      {allDayEventStyle === 'none' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 shadow-2xs" />
                      )}
                      <span className={`truncate leading-none ${verticalFontSize === 'huge' ? 'text-xs' : 'text-[11px]'} ${verticalFontWeight === 'extrabold' ? 'font-black' : verticalFontWeight === 'bold' ? 'font-bold' : 'font-medium'} ${allDayEventStyle === 'filled' ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                        終日出張
                      </span>
                    </div>

                    {/* 時間指定予定プレビュー */}
                    <div
                      style={
                        timedEventStyle === 'underbar'
                          ? { borderBottom: '2.5px solid #3b82f6', backgroundColor: 'transparent' }
                          : timedEventStyle === 'none'
                          ? { backgroundColor: 'transparent' }
                          : { backgroundColor: '#3b82f6' }
                      }
                      className={`h-[20px] px-2 flex items-center gap-1 overflow-hidden ${
                        timedEventStyle === 'underbar'
                          ? 'border-b-[2.5px] border-blue-500 text-slate-800 dark:text-slate-100 rounded-none'
                          : timedEventStyle === 'none'
                          ? 'text-slate-800 dark:text-slate-100'
                          : 'rounded-md text-white shadow-2xs'
                      }`}
                    >
                      {timedEventStyle === 'none' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 shadow-2xs" />
                      )}
                      <span className={`text-[10px] tabular-nums font-normal shrink-0 ${timedEventStyle === 'filled' ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}>
                        10:00
                      </span>
                      <span className={`truncate leading-none ${verticalFontSize === 'huge' ? 'text-xs' : 'text-[11px]'} ${verticalFontWeight === 'extrabold' ? 'font-black' : verticalFontWeight === 'bold' ? 'font-bold' : 'font-medium'} ${timedEventStyle === 'filled' ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                        企画会議
                      </span>
                    </div>
                  </div>
                </div>

                {/* Font Size Selector (7-step Granular Selection) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    <span>文字の大きさ（全7段階）</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">
                      {fontSizes.find((f) => f.id === verticalFontSize)?.label || '大'} (
                      {Math.max(1, fontSizes.findIndex((f) => f.id === verticalFontSize) + 1)}/7)
                    </span>
                  </div>

                  {/* Stepper & Slider */}
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      disabled={fontSizes.findIndex((f) => f.id === verticalFontSize) <= 0}
                      onClick={() => {
                        const idx = Math.max(0, fontSizes.findIndex((f) => f.id === verticalFontSize) - 1);
                        setVerticalFontSize(fontSizes[idx].id);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-30 text-xs font-bold transition active:scale-95 cursor-pointer"
                      title="小さくする"
                    >
                      －
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={fontSizes.length - 1}
                      step={1}
                      value={Math.max(0, fontSizes.findIndex((f) => f.id === verticalFontSize))}
                      onChange={(e) => setVerticalFontSize(fontSizes[Number(e.target.value)].id)}
                      className="flex-1 accent-blue-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                    />
                    <button
                      type="button"
                      disabled={fontSizes.findIndex((f) => f.id === verticalFontSize) >= fontSizes.length - 1}
                      onClick={() => {
                        const idx = Math.min(
                          fontSizes.length - 1,
                          Math.max(0, fontSizes.findIndex((f) => f.id === verticalFontSize) + 1)
                        );
                        setVerticalFontSize(fontSizes[idx].id);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-30 text-xs font-bold transition active:scale-95 cursor-pointer"
                      title="大きくする"
                    >
                      ＋
                    </button>
                  </div>

                  {/* 7-Step Segmented Pills */}
                  <div className="grid grid-cols-7 gap-1 bg-slate-200/60 dark:bg-slate-700/60 p-1 rounded-xl">
                    {fontSizes.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setVerticalFontSize(item.id)}
                        className={`py-1 rounded-md text-[10px] font-semibold transition active:scale-95 text-center ${
                          verticalFontSize === item.id
                            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                        title={item.label}
                      >
                        {item.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Weight Selector */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    文字の太さ
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-200/60 dark:bg-slate-700/60 p-1 rounded-xl">
                    {fontWeights.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setVerticalFontWeight(item.id)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition active:scale-95 ${
                          verticalFontWeight === item.id
                            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Monthly Typography: Font Size & Weight Customization */}
              <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    月間カレンダーの文字設定（日付・曜日・予定）
                  </span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-100/70 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                    月表示に即時反映
                  </span>
                </div>

                {/* Monthly Preview */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center gap-3">
                  <div className="flex flex-col items-center justify-center shrink-0 w-12 border-r border-slate-200 dark:border-slate-700 pr-2">
                    <span
                      className={`text-slate-500 dark:text-slate-400 leading-none mb-1 ${
                        monthlyFontSize === 'xlarge'
                          ? 'text-xs'
                          : monthlyFontSize === 'large'
                          ? 'text-[11px]'
                          : monthlyFontSize === 'normal'
                          ? 'text-[10px]'
                          : 'text-[9px]'
                      } ${
                        monthlyFontWeight === 'extrabold'
                          ? 'font-black'
                          : monthlyFontWeight === 'bold'
                          ? 'font-bold'
                          : 'font-normal'
                      }`}
                    >
                      金
                    </span>
                    <span
                      className={`tabular-nums leading-none text-blue-600 dark:text-blue-400 ${
                        monthlyFontSize === 'xlarge'
                          ? 'text-lg font-black'
                          : monthlyFontSize === 'large'
                          ? 'text-base font-bold'
                          : monthlyFontSize === 'normal'
                          ? 'text-sm font-bold'
                          : 'text-xs font-semibold'
                      } ${
                        monthlyFontWeight === 'extrabold'
                          ? 'font-black'
                          : monthlyFontWeight === 'bold'
                          ? 'font-bold'
                          : 'font-normal'
                      }`}
                    >
                      21
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div
                      className={`px-2 py-0.5 rounded bg-blue-600 text-white truncate shadow-2xs ${
                        monthlyFontSize === 'xlarge'
                          ? 'text-xs'
                          : monthlyFontSize === 'large'
                          ? 'text-[11.5px]'
                          : monthlyFontSize === 'normal'
                          ? 'text-[10.5px]'
                          : 'text-[9.5px]'
                      } ${
                        monthlyFontWeight === 'extrabold'
                          ? 'font-black'
                          : monthlyFontWeight === 'bold'
                          ? 'font-bold'
                          : 'font-medium'
                      }`}
                    >
                      終日出張
                    </div>
                    <div
                      className={`px-2 py-0.5 rounded border border-blue-400/60 bg-blue-50 dark:bg-blue-950/60 text-slate-800 dark:text-slate-100 truncate ${
                        monthlyFontSize === 'xlarge'
                          ? 'text-xs'
                          : monthlyFontSize === 'large'
                          ? 'text-[11.5px]'
                          : monthlyFontSize === 'normal'
                          ? 'text-[10.5px]'
                          : 'text-[9.5px]'
                      } ${
                        monthlyFontWeight === 'extrabold'
                          ? 'font-black'
                          : monthlyFontWeight === 'bold'
                          ? 'font-bold'
                          : 'font-medium'
                      }`}
                    >
                      14:00 定例ミーティング
                    </div>
                  </div>
                </div>

                {/* Monthly Font Size Selector */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    <span>文字の大きさ</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">
                      {monthlyFontSizes.find((f) => f.id === monthlyFontSize)?.label || '大'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 bg-slate-200/60 dark:bg-slate-700/60 p-1 rounded-xl">
                    {monthlyFontSizes.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setMonthlyFontSize(item.id)}
                        className={`py-1.5 px-1 rounded-lg text-xs font-semibold transition active:scale-95 text-center ${
                          monthlyFontSize === item.id
                            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                        title={item.desc}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Monthly Font Weight Selector */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    文字の太さ
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-200/60 dark:bg-slate-700/60 p-1 rounded-xl">
                    {monthlyFontWeights.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setMonthlyFontWeight(item.id)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition active:scale-95 ${
                          monthlyFontWeight === item.id
                            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center relative border border-slate-200 dark:border-slate-700">
                <div className="text-center absolute top-2 left-3 text-[10px] text-slate-400 font-semibold">
                  リアルタイムプレビュー
                </div>

                <svg className="w-48 h-16">
                  <defs>
                    <marker
                      id="settings-preview-arrowhead"
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
                    y1="32"
                    x2="160"
                    y2="32"
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
                    markerEnd="url(#settings-preview-arrowhead)"
                  />
                </svg>
              </div>

              {/* Thickness Options */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5 block">
                  線の太さ
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
          )}
        </div>

        {/* Footer Button */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-sm active:scale-98"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};
