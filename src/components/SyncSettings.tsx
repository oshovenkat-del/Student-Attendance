import React, { useState, useEffect } from 'react';
import { SheetSyncInfo, Student } from '../types';
import { fetchSpreadsheets, createNewAttendanceSheet, SpreadsheetFile } from '../lib/googleSheets';
import { Cloud, CloudOff, RefreshCw, FileSpreadsheet, Plus, HelpCircle, Check, LogOut, ArrowRight, Database, ExternalLink, Search } from 'lucide-react';
import { CURRENT_MONTH_NAME, CURRENT_YEAR, CURRENT_MONTH_INDEX } from '../data/students';

interface SyncSettingsProps {
  user: any;
  accessToken: string | null;
  syncInfo: SheetSyncInfo | null;
  needsAuth: boolean;
  isLoggingIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onSelectSpreadsheet: (id: string, name: string) => void;
  onImportClassRoster?: (id: string, name: string) => void;
  onResetToSandbox: () => void;
  students: Student[];
  onSyncSuccess: (syncInfo: SheetSyncInfo) => void;
}

export const SyncSettings: React.FC<SyncSettingsProps> = ({
  user,
  accessToken,
  syncInfo,
  needsAuth,
  isLoggingIn,
  onLogin,
  onLogout,
  onSelectSpreadsheet,
  onImportClassRoster,
  onResetToSandbox,
  students,
  onSyncSuccess,
}) => {
  const daysInMonth = new Date(CURRENT_YEAR, CURRENT_MONTH_INDEX + 1, 0).getDate();
  const lastColLetter = daysInMonth === 31 ? 'AI' : (daysInMonth === 30 ? 'AH' : (daysInMonth === 29 ? 'AG' : 'AF'));
  const lastColIndexStr = daysInMonth === 31 ? '35th' : (daysInMonth === 30 ? '34th' : (daysInMonth === 29 ? '33rd' : '32nd'));

  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch spreadsheets once we have an access token
  useEffect(() => {
    if (accessToken) {
      loadSpreadsheets();
    }
  }, [accessToken]);

  const loadSpreadsheets = async (query = searchQuery) => {
    setLoadingSpreadsheets(true);
    setErrorMsg(null);
    try {
      if (!accessToken) return;
      const list = await fetchSpreadsheets(accessToken, query);
      setSpreadsheets(list);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to list spreadsheets from Google Drive');
    } finally {
      setLoadingSpreadsheets(false);
    }
  };

  // Create a brand new formatted attendance spreadsheet in Google Drive
  const handleCreateNewSheet = async () => {
    if (!accessToken) return;
    
    const title = window.prompt(
      'Enter a name for your new Google Sheet:',
      `Student Attendance - Month of ${CURRENT_MONTH_NAME} ${CURRENT_YEAR}`
    );
    if (!title) return;

    setCreatingSheet(true);
    setErrorMsg(null);
    try {
      const newId = await createNewAttendanceSheet(accessToken, title, students);
      onSelectSpreadsheet(newId, title);
      alert(`Successfully created "${title}" in your Google Drive and linked it!`);
      loadSpreadsheets();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create a new spreadsheet');
    } finally {
      setCreatingSheet(false);
    }
  };

  return (
    <div className="space-y-6" id="sync-settings-section">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Connection Card */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-2xs">
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider text-gray-400">
            Cloud Sync Status
          </h3>

          {needsAuth ? (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl flex items-start gap-3">
                <CloudOff className="text-gray-400 mt-0.5 shrink-0" size={20} />
                <div>
                  <h4 className="font-bold text-gray-700 text-sm">Sandbox Mode (Offline)</h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    You are currently using the local sandbox environment. Data is safely saved to your browser's local state, but will not sync with any spreadsheet.
                  </p>
                </div>
              </div>

              <button
                onClick={onLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2.5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                id="sign-in-google-btn"
              >
                <Cloud size={18} />
                {isLoggingIn ? 'Connecting to Google...' : 'Sign in with Google'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Logged in User info */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                  {user?.displayName ? user.displayName.split(' ').map((n: string) => n[0]).join('') : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-gray-800 text-sm truncate">{user?.displayName || 'Teacher Account'}</h4>
                  <p className="text-xs text-gray-500 truncate">{user?.email || 'Connected'}</p>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100/60 text-emerald-800 font-bold rounded-full text-[10px]">
                  <Check size={10} /> Live Sync
                </div>
              </div>

              {/* Linked Sheet Details */}
              {syncInfo ? (
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                  <span className="text-[10px] uppercase font-bold text-indigo-400">Linked Spreadsheet</span>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileSpreadsheet className="text-indigo-600 shrink-0" size={18} />
                      <span className="font-bold text-gray-800 text-sm truncate" title={syncInfo.spreadsheetName}>
                        {syncInfo.spreadsheetName}
                      </span>
                    </div>
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${syncInfo.spreadsheetId}/edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors bg-white hover:bg-indigo-50 rounded-lg border border-gray-100 hover:border-indigo-200 shadow-3xs flex items-center justify-center"
                      title="Open in Google Sheets / Drive"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Tab: <span className="font-medium">{syncInfo.sheetName}</span>
                  </div>
                  {syncInfo.lastSynced && (
                    <div className="text-[10px] text-gray-400">
                      Last uploaded: {new Date(syncInfo.lastSynced).toLocaleString()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                  <h4 className="font-bold text-amber-800 text-sm">No Sheet Connected</h4>
                  <p className="text-xs text-amber-600 mt-1 leading-relaxed">
                    Choose one of your existing Google Sheets on the right, or create a brand new structured spreadsheet to sync.
                  </p>
                </div>
              )}

              {/* Log out option */}
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 font-semibold rounded-xl text-xs transition-colors"
                id="sign-out-btn"
              >
                <LogOut size={14} />
                Disconnect Google Account
              </button>
            </div>
          )}

          {/* Local State Sandbox Reset */}
          <div className="pt-4 border-t border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-2">Sandbox Management</span>
            <button
              onClick={onResetToSandbox}
              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-100 transition-colors flex items-center justify-center gap-1.5"
              id="reset-sandbox-btn"
            >
              <Database size={14} />
              Reset All Local State
            </button>
          </div>
        </div>

        {/* Right column: Sheets Picker / Creator */}
        {!needsAuth && (
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6 space-y-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-50">
              <div>
                <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider text-gray-400">
                  Google Drive Spreadsheet Integrations
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Select a sheet from your Drive, or initialize a clean roster template.</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => loadSpreadsheets(searchQuery)}
                  disabled={loadingSpreadsheets}
                  className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg border border-gray-200 transition-colors"
                  title="Refresh Spreadsheet List"
                  id="refresh-list-btn"
                >
                  <RefreshCw size={14} className={loadingSpreadsheets ? 'animate-spin' : ''} />
                </button>
                
                <button
                  onClick={handleCreateNewSheet}
                  disabled={creatingSheet}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  id="create-new-sheet-btn"
                >
                  <Plus size={14} />
                  {creatingSheet ? 'Creating Sheet...' : 'Create Attendance Sheet'}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg text-xs font-medium">
                {errorMsg}
              </div>
            )}

            {/* Google Drive Search Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Search spreadsheets in Google Drive..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      loadSpreadsheets(searchQuery);
                    }
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-medium focus:outline-hidden transition-all"
                  id="search-drive-sheets-input"
                />
              </div>
              <button
                onClick={() => loadSpreadsheets(searchQuery)}
                disabled={loadingSpreadsheets}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0 shadow-3xs"
              >
                Search
              </button>
            </div>

            {/* List of Spreadsheets */}
            {loadingSpreadsheets ? (
              <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-indigo-500" />
                <span>Loading sheets from Google Drive...</span>
              </div>
            ) : spreadsheets.length === 0 ? (
              <div className="py-12 border border-dashed border-gray-100 rounded-xl text-center text-gray-400 text-xs">
                No spreadsheets found in your Google Drive. Try adjusting your search query, or click "Create Attendance Sheet" to make a perfectly-formatted sheet now.
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {spreadsheets.map((sheet) => {
                  const isCurrent = syncInfo?.spreadsheetId === sheet.id;
                  const formattedModifiedTime = sheet.modifiedTime 
                    ? new Date(sheet.modifiedTime).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : null;
                  const viewUrl = sheet.webViewLink || `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`;

                  return (
                    <div
                      key={sheet.id}
                      className={`p-3 rounded-xl border flex justify-between items-center gap-4 transition-all ${
                        isCurrent
                          ? 'bg-indigo-50/50 border-indigo-200 shadow-2xs'
                          : 'bg-white hover:bg-gray-50/50 border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <FileSpreadsheet className={isCurrent ? 'text-indigo-600' : 'text-emerald-600'} size={20} />
                        <div className="truncate">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-gray-800 text-sm truncate" title={sheet.name}>{sheet.name}</span>
                            <a
                              href={viewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-indigo-600 transition-colors inline-flex items-center"
                              title="Open in Google Sheets / Drive"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-[10px] text-gray-400 mt-0.5 font-medium">
                            <span className="font-mono truncate max-w-[150px]">ID: {sheet.id}</span>
                            {formattedModifiedTime && (
                              <span className="hidden sm:inline text-gray-300">•</span>
                            )}
                            {formattedModifiedTime && (
                              <span>Modified: {formattedModifiedTime}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isCurrent ? (
                          <div className="px-3 py-1.5 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-lg flex items-center gap-1">
                            <Check size={12} /> Connected
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => onSelectSpreadsheet(sheet.id, sheet.name)}
                              className="px-3 py-1.5 bg-gray-50 hover:bg-indigo-600 hover:text-white border border-gray-200 hover:border-indigo-600 text-gray-600 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                              title="Connect this spreadsheet to log attendance for the current class"
                            >
                              Connect
                            </button>
                            {onImportClassRoster && (
                              <button
                                onClick={() => onImportClassRoster(sheet.id, sheet.name)}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 text-emerald-700 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer animate-pulse-subtle"
                                title="Import a new class of students from this spreadsheet roster"
                              >
                                Import Class
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Roster & Setup Guidelines */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 space-y-4 shadow-2xs">
        <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <HelpCircle size={18} className="text-indigo-500" />
          Roster Synchronization Help & Format Guidelines
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-600 leading-relaxed">
          <div className="space-y-2">
            <p className="font-bold text-gray-700">Connecting your existing sheet:</p>
            <p>
              This app is designed to align with standard attendance templates. If you are syncing with your own existing Google Sheet, make sure your tab has the following structure:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>**Row 3** should contain headers like `S.No`, `Enr.Number`, `Name`, `Gender`.</li>
              <li>Columns **E to {lastColLetter}** (5th to {lastColIndexStr} column) represent the days of {CURRENT_MONTH_NAME} {CURRENT_YEAR}.</li>
              <li>Student records must start on **Row 4** with their correct Enrollment ID.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-gray-700">Creating a clean new template:</p>
            <p>
              To guarantee perfect formula calculations (Total Present, Total Absent, and Average Attendance percentages) and automatic frozen columns, click the **"Create Attendance Sheet"** button. This creates a beautifully styled spreadsheet preloaded with your 34 students in your Google Drive immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
