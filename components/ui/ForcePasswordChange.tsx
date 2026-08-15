"use client";

import React, { useState } from "react";
import { useSession, changePassword } from "@/lib/auth";
import Modal from "./Modal";

const ForcePasswordChange = () => {
  const { data: session, update } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mustChange = session?.user?.mustChangePassword === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const result = await changePassword(currentPassword, newPassword);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    update();
  };

  if (!mustChange) return null;

  return (
    <Modal isOpen={mustChange} onClose={() => {}} title="Change Your Password" dismissible={false}>
      <div className="space-y-4">
        <p className="text-sm font-mono text-gray-300">
          You must set a new password before continuing.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-mono text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-500"
          />
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-mono text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-500"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-mono text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-500"
          />
          {error && <p className="text-sm font-mono text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl text-sm font-mono font-bold border border-purple-400/20 hover:from-purple-700 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? "Updating..." : "Change Password"}
          </button>
        </form>
      </div>
    </Modal>
  );
};

export default ForcePasswordChange;
