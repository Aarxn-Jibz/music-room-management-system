"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

interface SystemSettings {
  sheets_spreadsheet_id: string | null;
  sheets_sheet_name: string | null;
}

const WeeklySheetSettings: React.FC = () => {
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetPrefix, setSheetPrefix] = useState("");
  const [savedSpreadsheetId, setSavedSpreadsheetId] = useState("");
  const [savedSheetPrefix, setSavedSheetPrefix] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<SystemSettings>("/api/system-settings");
      const id = res.data.sheets_spreadsheet_id ?? "";
      const prefix = res.data.sheets_sheet_name ?? "";
      setSpreadsheetId(id);
      setSheetPrefix(prefix);
      setSavedSpreadsheetId(id);
      setSavedSheetPrefix(prefix);
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "Failed to load weekly sheet settings." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await axios.put("/api/system-settings", {
        sheets_spreadsheet_id: spreadsheetId.trim(),
        sheets_sheet_name: sheetPrefix.trim(),
      });
      setSavedSpreadsheetId(spreadsheetId.trim());
      setSavedSheetPrefix(sheetPrefix.trim());
      setMessage({ type: "success", text: "Weekly sheet settings saved." });
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "Failed to save weekly sheet settings." });
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const res = await axios.post("/api/sheets/weekly", {});
      const data = res.data as { status: string; tabName?: string | null; reason?: string; error?: string };
      if (data.status === "ok") {
        setMessage({ type: "success", text: `Weekly sheet exported to tab "${data.tabName}".` });
      } else if (data.status === "skipped") {
        setMessage({ type: "error", text: `Skipped: ${data.reason ?? "not configured"}.` });
      } else {
        setMessage({ type: "error", text: `Export failed: ${data.error ?? "unknown error"}.` });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "Failed to run the weekly sheet export." });
    } finally {
      setRunning(false);
    }
  };

  const dirty =
    spreadsheetId.trim() !== savedSpreadsheetId || sheetPrefix.trim() !== savedSheetPrefix;

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-white w-full shadow-2xl relative mt-6">
      <h2 className="text-2xl font-bold mb-6 font-mono">Weekly Google Sheets Grid</h2>
      <p className="text-sm text-gray-400 mb-4 font-mono">
        Approved bookings are exported every Sunday 15:30 UTC (21:00 IST) to a deterministic tab
        named &quot;Week of YYYY-MM-DD&quot;. Share the spreadsheet with the service account email
        and configure its ID here.
      </p>

      {loading ? (
        <div className="h-11 rounded-xl bg-white/5 animate-pulse" />
      ) : (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={spreadsheetId}
            onChange={(e) => setSpreadsheetId(e.target.value)}
            placeholder="Google Spreadsheet ID"
            className="flex-1 font-mono px-4 py-3 bg-black-100/60 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          />
          <input
            type="text"
            value={sheetPrefix}
            onChange={(e) => setSheetPrefix(e.target.value)}
            placeholder="Tab prefix (optional, e.g. ACM Studio)"
            className="flex-1 font-mono px-4 py-3 bg-black-100/60 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          />
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="font-mono px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl border border-purple-400/20 shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-purple-400 active:scale-[0.98] text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={runNow}
            disabled={running}
            className="font-mono px-6 py-3 bg-black-100/60 border border-white/10 rounded-xl text-sm font-semibold transition-all hover:bg-white/5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? "Running..." : "Run export now"}
          </button>
        </div>
      )}

      {message && (
        <p
          className={`mt-4 text-sm font-mono ${
            message.type === "success" ? "text-green-300" : "text-red-300"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
};

export default WeeklySheetSettings;
