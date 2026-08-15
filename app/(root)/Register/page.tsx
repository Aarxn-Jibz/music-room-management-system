"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useSession } from "@/lib/auth";
import { motion } from "framer-motion";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";
import Modal from "@/components/ui/Modal";
import BandMultiSelect from "@/components/ui/BandMultiSelect";
import ColorPicker from "@/components/ui/ColorPicker";
import { MotionWrapper } from "@/components/ui/MotionWrapper";

const Navbar = dynamic(() => import("@/components/Navbar"), {
  ssr: false,
  loading: () => <div className="h-[64px] w-full bg-background/60 backdrop-blur-lg" />,
});

interface DbUser {
  id: string;
  name: string;
  email: string;
  role: string;
  bands: Array<{ id: string; name: string }>;
}

interface Band {
  id: string;
  name: string;
  colour: string;
}

const RegisterPage = () => {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [dbUsers, setDbUsers] = useState<DbUser[]>([]);
  const [bands, setBands] = useState<Band[]>([]);

  const [isModalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "admin") {
      router.replace("/");
    }
  }, [session, status, router]);

  const fetchData = async () => {
    try {
      const [usersRes, bandsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/bands"),
      ]);
      const usersData = (await usersRes.json()) as DbUser[];
      const bandsData = (await bandsRes.json()) as Band[];
      setDbUsers(usersData);
      setBands(bandsData);
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = (title: string, content: React.ReactNode) => {
    setModalTitle(title);
    setModalContent(content);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalTitle("");
    setModalContent(null);
    fetchData();
  };

  if (status === "loading" || !session || session.user.role !== "admin") {
    return null;
  }

  return (
    <MotionWrapper className="bg-black-100">
      <Navbar aria-label="Main Navigation" />
      <main className="relative bg-black-100 flex justify-center items-center flex-col mx-auto px-4 sm:px-10 min-h-screen">
        <div className="w-full pt-20 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-white w-full shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold font-mono">Users</h2>
                <button
                  onClick={() => openModal("Register User", <UserForm bands={bands} onFinished={closeModal} />)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl border border-purple-400/20 shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-purple-400 active:scale-[0.98] text-xs sm:text-sm font-mono font-semibold transition-all"
                >
                  <FaPlus className="text-[10px] sm:text-xs" />
                  Add User
                </button>
              </div>
              <div className={`overflow-x-auto ${mounted ? "overflow-y-auto" : "overflow-y-hidden"} max-h-[400px] rounded-2xl border border-white/10 bg-white/[0.02] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full`}>
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-900">
                      <th className="p-2 sm:p-4 text-xs font-bold uppercase tracking-wider text-gray-400">Name</th>
                      <th className="p-2 sm:p-4 text-xs font-bold uppercase tracking-wider text-gray-400">Email</th>
                      <th className="p-2 sm:p-4 text-xs font-bold uppercase tracking-wider text-gray-400">Profiles</th>
                      <th className="p-2 sm:p-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbUsers.map((user, idx) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.02 }}
                        className="border-b border-white/10 hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="p-2 sm:p-4 font-mono text-sm text-gray-300">{user.name}</td>
                        <td className="p-2 sm:p-4 font-mono text-sm text-gray-400">{user.email}</td>
                        <td className="p-2 sm:p-4 font-mono text-sm text-gray-400">{user.bands.map(b => b.name).join(", ") || "—"}</td>
                        <td className="p-2 sm:p-4 font-mono text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openModal("Edit User", <UserForm user={user} bands={bands} onFinished={closeModal} />)}
                              className="p-2 rounded-lg hover:bg-white/10 transition-all text-blue-400"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => openModal("Delete User", <DeleteConfirmation type="user" id={user.id} onFinished={closeModal} />)}
                              className="p-2 rounded-lg hover:bg-white/10 transition-all text-gray-400"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                    {dbUsers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500 text-sm">No users found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-white w-full shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold font-mono">Profiles</h2>
                <button
                  onClick={() => openModal("Register Profile", <BandForm onFinished={closeModal} />)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl border border-purple-400/20 shadow-lg shadow-purple-500/25 hover:from-purple-500 hover:to-purple-400 active:scale-[0.98] text-xs sm:text-sm font-mono font-semibold transition-all"
                >
                  <FaPlus className="text-[10px] sm:text-xs" />
                  Add Profile
                </button>
              </div>
              <div className={`overflow-x-auto ${mounted ? "overflow-y-auto" : "overflow-y-hidden"} max-h-[400px] rounded-2xl border border-white/10 bg-white/[0.02] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full`}>
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-900">
                      <th className="p-2 sm:p-4 text-xs font-bold uppercase tracking-wider text-gray-400">Name</th>
                      <th className="p-2 sm:p-4 text-xs font-bold uppercase tracking-wider text-gray-400">Color</th>
                      <th className="p-2 sm:p-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bands.map((band, idx) => (
                      <motion.tr
                        key={band.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.02 }}
                        className="border-b border-white/10 hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="p-2 sm:p-4 font-mono text-sm text-gray-300">{band.name}</td>
                        <td className="p-2 sm:p-4 font-mono">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md border border-white/20" style={{ backgroundColor: band.colour }} />
                            <span className="text-xs text-gray-500">{band.colour}</span>
                          </div>
                        </td>
                        <td className="p-2 sm:p-4 font-mono text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openModal("Edit Profile", <BandForm band={band} onFinished={closeModal} />)}
                              className="p-2 rounded-lg hover:bg-white/10 transition-all text-blue-400"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => openModal("Delete Profile", <DeleteConfirmation type="band" id={band.id} onFinished={closeModal} />)}
                              className="p-2 rounded-lg hover:bg-white/10 transition-all text-gray-400"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                    {bands.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-gray-500 text-sm">No profiles found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Modal isOpen={isModalOpen} onClose={closeModal} title={modalTitle}>
        {modalContent}
      </Modal>
    </MotionWrapper>
  );
};

// --- Modal Form Components ---

const inputClass = "w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white font-mono outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-500";
const labelClass = "text-xs font-bold text-gray-400 uppercase font-mono";
const btnClass = "w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white text-sm font-bold font-mono rounded-xl border border-purple-400/20 hover:from-purple-700 hover:to-purple-600 transition-all shadow-lg shadow-purple-500/25 active:scale-[0.98]";

const UserForm = ({ user, bands, onFinished }: { user?: DbUser, bands: Band[], onFinished: () => void }) => {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [selectedBandIds, setSelectedBandIds] = useState<string[]>(user?.bands.map(b => b.id) || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, email, bandIds: selectedBandIds };
    const url = user ? `/api/users?id=${user.id}` : '/api/auth/register';
    const method = user ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      onFinished();
    } catch (error) {
      console.error("Failed to save user", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className={labelClass}>Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Name" required className={inputClass} />
      </div>
      <div className="space-y-2">
        <label className={labelClass}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className={inputClass} />
      </div>
      {!user && (
        <p className="text-xs text-gray-500 font-mono">
          Temporary password: <span className="text-gray-300">changeit</span> — user will be forced to change it on first login.
        </p>
      )}
      <div className="space-y-2">
        <label className={labelClass}>Profiles</label>
        <BandMultiSelect value={selectedBandIds} onChange={setSelectedBandIds} bands={bands} />
      </div>
      <button type="submit" className={btnClass}>Save</button>
    </form>
  );
};

const BandForm = ({ band, onFinished }: { band?: Band, onFinished: () => void }) => {
  const [name, setName] = useState(band?.name || "");
  const [colour, setColour] = useState(band?.colour || "#ffffff");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, colour };
    const url = band ? `/api/bands?id=${band.id}` : '/api/bands';
    const method = band ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      onFinished();
    } catch (error) {
      console.error("Failed to save band", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className={labelClass}>Profile Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Profile Name" required className={inputClass} />
      </div>
      <div className="space-y-2">
        <label className={labelClass}>Color</label>
        <ColorPicker value={colour} onChange={setColour} />
      </div>
      <button type="submit" className={btnClass}>Save</button>
    </form>
  );
};

const DeleteConfirmation = ({ type, id, onFinished }: { type: 'user' | 'band', id: string, onFinished: () => void }) => {
  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/${type}s?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      onFinished();
    } catch (error) {
      console.error(`Failed to delete ${type}`, error);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400 font-mono">Are you sure you want to delete this {type}? This action cannot be undone.</p>
      <div className="flex justify-end gap-3">
        <button onClick={onFinished} className="px-5 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm font-mono text-gray-300 hover:bg-white/20 transition-all">Cancel</button>
        <button onClick={handleDelete} className="px-5 py-2.5 bg-red-500/20 border border-red-500/30 rounded-xl text-sm font-mono text-red-300 hover:bg-red-500/30 transition-all">Delete</button>
      </div>
    </div>
  );
};

export default RegisterPage;
