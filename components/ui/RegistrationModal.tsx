"use client";

import Modal from "./Modal"; // Using the new generic modal
import { useState, useEffect } from "react";

interface Band {
  id: string;
  name: string;
  colour: string;
}

export default function RegistrationModal({ 
  isOpen, 
  onClose 
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [regName, setRegName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regBands, setRegBands] = useState<Band[]>([]);
  const [selectedBandIds, setSelectedBandIds] = useState<string[]>([]);
  const [loadingBands, setLoadingBands] = useState(true);
  const [regError, setRegError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      (async () => {
        try {
          setLoadingBands(true);
          const res = await fetch("/api/bands");
          const data = (await res.json()) as Band[];
          setRegBands(data);
        } catch (e) {
          console.error("unable to load bands", e);
        } finally {
          setLoadingBands(false);
        }
      })();
    }
  }, [isOpen]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setIsSubmitting(true);
    
    try {
      const payload = {
        name: regName,
        password: regPassword,
        email: regEmail,
        role: "user",
        bandIds: selectedBandIds,
      };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setRegError(data.message || "Registration failed");
      } else {
        onClose();
        setRegName("");
        setRegPassword("");
        setRegEmail("");
        setSelectedBandIds([]);
        alert("Registration successful! You can now Sign In.");
      }
    } catch (err) {
      console.error("Error registering user:", err);
      setRegError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions, option => option.value);
    setSelectedBandIds(values);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register User">
      <form onSubmit={handleRegisterSubmit} className="space-y-4">
        <input 
          type="text"
          placeholder="Name"
          value={regName}
          onChange={e => setRegName(e.target.value)}
          required
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600 text-white"
        />
        <input 
          type="email"
          placeholder="Email"
          value={regEmail}
          onChange={e => setRegEmail(e.target.value)}
          required
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600 text-white"
        />
        <input 
          type="password"
          placeholder="Password"
          value={regPassword}
          onChange={e => setRegPassword(e.target.value)}
          required
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600 text-white"
        />
        <select
          multiple
          value={selectedBandIds}
          onChange={handleSelectionChange}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600 text-white h-32"
          disabled={loadingBands}
        >
          {loadingBands ? (
            <option>Loading profiles...</option>
          ) : (
            regBands.map((band) => (
              <option key={band.id} value={band.id} className="text-white">
                {band.name}
              </option>
            ))
          )}
        </select>
        
        <div className="text-xs text-gray-400 mt-1">
          <span>Don't see your profile listed? Kindly contact Roshan Sir</span>
        </div>

        {regError && (
          <div className="text-red-400 p-3 rounded bg-red-900/20 border border-red-500/30">
            {regError}
          </div>
        )}
        
        <div className="flex justify-end pt-4">
          <button 
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Processing..." : "Confirm"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
