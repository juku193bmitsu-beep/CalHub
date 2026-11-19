import React, { useState, useEffect } from 'react';
import { useCalendar } from '../../contexts/CalendarContext';
import { useEvents } from '../../contexts/EventContext';
import { googleAuth } from '../../services/googleAuth';
import {
  ArrowThickness,
  ArrowPattern,
  ArrowHeadStyle,
  VerticalFontSize,
  VerticalFontWeight,
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
} from 'lucide-react';

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
    timedEventStyle,
    setTimedEventStyle,
    showZoomControls,
    setShowZoomControls,
    verticalFontSize,
    setVerticalFontSize,
    verticalFontWeight,
    setVerticalFontWeight,
    authToken,
    setAuthToken,
    theme,
    toggleTheme,
  } = useCalendar();

  const { clearAllEvents, resetToMockEvents, refreshEvents, eventStats, isSyncingEvents } = useEvents();

  const [activeTab, setActiveTab] = useState<'calendars' | 'google' | 'arrows'>(initialTab);
  const [clientIdInput, setClientIdInput] = useState(googleAuth.getClientId());
  const [isSavedClientNotice, setIsSavedClientNotice] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

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

  const fontSizes: { id: VerticalFontSize; label: string }[] = [
    { id: 'normal', label: '標準' },
    { id: 'large', label: '大 (推奨)' },
    { id: 'xlarge', label: '特大' },
  ];

  const fontWeights: { id: VerticalFontWeight; label: string }[] = [
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
                  return (
                    <div
                      key={cal.id}
                      onClick={() => toggleCalendarVisibility(cal.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                        isChecked
                          ? 'border-blue-400/80 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: cal.backgroundColor }}
                        />
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {cal.summary}
                        </span>
                      </div>

                      {/* Custom Checkbox Toggle */}
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                          isChecked
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
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

          {/* TAB 3: ARROW STYLES */}
          {activeTab === 'arrows' && (
            <div className="space-y-4">
              {/* Timed Event Display Style Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  時間指定予定の表示スタイル
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTimedEventStyle('badge')}
                    className={`p-2.5 rounded-2xl border text-left transition flex flex-col gap-1.5 cursor-pointer ${
                      timedEventStyle === 'badge'
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-semibold">枠囲みバッジ</span>
                    <div className="px-2 py-0.5 rounded-lg border border-blue-400/60 bg-blue-100/50 dark:bg-blue-900/40 text-[10px] text-blue-800 dark:text-blue-200 truncate">
                      10:00 会議
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTimedEventStyle('underbar')}
                    className={`p-2.5 rounded-2xl border text-left transition flex flex-col gap-1.5 cursor-pointer ${
                      timedEventStyle === 'underbar'
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-xs font-semibold">アンダーバー (下線)</span>
                    <div className="px-1 py-0.5 border-b-[2.5px] border-blue-500 text-[10px] text-slate-800 dark:text-slate-100 truncate">
                      10:00 会議
                    </div>
                  </button>
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
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center gap-2">
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`w-6 h-6 flex items-center justify-center rounded-full bg-blue-600 text-white tabular-nums ${
                        verticalFontSize === 'xlarge'
                          ? 'text-[15px]'
                          : verticalFontSize === 'large'
                          ? 'text-[13.5px]'
                          : 'text-xs'
                      } ${
                        verticalFontWeight === 'extrabold'
                          ? 'font-black'
                          : verticalFontWeight === 'bold'
                          ? 'font-bold'
                          : 'font-semibold'
                      }`}
                    >
                      19
                    </span>
                    <span
                      className={`${
                        verticalFontSize === 'xlarge'
                          ? 'text-[13px]'
                          : verticalFontSize === 'large'
                          ? 'text-xs'
                          : 'text-[11px]'
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

                  <div className="flex-1 min-w-0">
                    <div
                      className="h-[22px] px-2 rounded-lg bg-blue-500/20 border border-blue-500/60 flex items-center gap-1.5 overflow-hidden"
                    >
                      <span
                        className={`${
                          verticalFontSize === 'xlarge'
                            ? 'text-[10.5px]'
                            : verticalFontSize === 'large'
                            ? 'text-[10px]'
                            : 'text-[9px]'
                        } opacity-80 font-normal tabular-nums shrink-0 text-slate-700 dark:text-slate-200`}
                      >
                        10:00
                      </span>
                      <span
                        className={`truncate leading-tight tracking-tight flex-1 ${
                          verticalFontSize === 'xlarge'
                            ? 'text-[13px]'
                            : verticalFontSize === 'large'
                            ? 'text-[12px]'
                            : 'text-[10.5px]'
                        } ${
                          verticalFontWeight === 'extrabold'
                            ? 'font-extrabold'
                            : verticalFontWeight === 'bold'
                            ? 'font-bold'
                            : 'font-medium'
                        } text-slate-800 dark:text-slate-100`}
                      >
                        企画会議（新製品）
                      </span>
                    </div>
                  </div>
                </div>

                {/* Font Size Selector */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    文字の大きさ
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-200/60 dark:bg-slate-700/60 p-1 rounded-xl">
                    {fontSizes.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setVerticalFontSize(item.id)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition active:scale-95 ${
                          verticalFontSize === item.id
                            ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {item.label}
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

              {/* Floating Zoom Button Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    縦型表示の拡大ボタン
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    右下の拡大・縮小ボタンの表示（ピンチ操作でも拡大縮小できます）
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowZoomControls(!showZoomControls)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    showZoomControls ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      showZoomControls ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
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
