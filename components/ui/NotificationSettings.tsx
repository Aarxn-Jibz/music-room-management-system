"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

interface SystemSettings {
  notification_email: string | null;
  booking_release_day: number;
  booking_release_time: string;
}

const NotificationSettings: React.FC = () => {
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<SystemSettings>("/api/system-settings");
      const current = res.data.notification_email ?? "";
      setEmail(current);
      setSavedEmail(current);
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "Failed to load notification settings." });
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
      await axios.put("/api/system-settings", { notification_email: email.trim() });
      setSavedEmail(email.trim());
      setMessage({ type: "success", text: "Notification email saved." });
    } catch (error) {
      console.error(error);
      setMessage({ type: "error", text: "Failed to save notification email. Enter a valid email or leave it empty." });
    } finally {
      setSaving(false);
    }
  };

  const dirty = email.trim() !== savedEmail;

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-white w-full shadow-2xl relative mt-6">
      <h2 className="text-2xl font-bold mb-6 font-mono">Booking Notifications</h2>
      <p className="text-sm text-gray-400 mb-4 font-mono">
        Booking request and approval/rejection emails are sent to this address. Leave it empty to disable emails.
      </p>

      {loading ? (
        <div className="h-11 rounded-xl bg-white/5 animate-pulse" />
      ) : (
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            className="flex-1 font-mono px-4 py-3 bg-black-100/60 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          />
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="font-mono px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl border border-purple-400/20 shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-purple-400 active:scale-[0.98] text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save"}
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

export default NotificationSettings;
