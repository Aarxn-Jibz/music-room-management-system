"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import Modal from "./ui/Modal";

const NavbarComponent = () => {
  const { data: session } = useSession();
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY < lastScrollY || window.scrollY < 50) {
        setShowNavbar(true);
      } else {
        setShowNavbar(false);
      }
      setLastScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result?.error) {
      alert("Invalid credentials");
    } else {
      setLoginModalOpen(false);
    }
    setIsLoggingIn(false);
  };

  const navLinks = [
    { href: "/home", label: "Home" },
    { href: "/RoomBooking", label: "Room Booking", auth: true },
    { href: "/SlotRequests", label: "Slot Requests", auth: true },
    { href: "/Dashboard", label: "Dashboard", admin: true },
    { href: "/Register", label: "Register", admin: true },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-40 w-full bg-black/50 backdrop-blur-xl border-b border-white/10 transition-transform duration-300 ${
          showNavbar || isMenuOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left side: Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center gap-2">
                <Image src="/SWO_Logo.png" alt="SWO Logo" width={40} height={40} priority />
                <span className="text-white font-bold text-xl hidden sm:block">SWO</span>
              </Link>
            </div>

            {/* Center: Desktop Menu */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-center gap-1">
                {navLinks.map(({ href, label, auth, admin }) => {
                  const isActive = pathname === href;
                  if ((auth && !session) || (admin && session?.user?.role !== 'admin')) {
                    return null;
                  }
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`relative px-4 py-2 text-sm font-mono font-medium transition-all ${
                        isActive
                          ? "text-purple-300"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {label}
                      {isActive && (
                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-400 shadow-lg shadow-purple-500/80" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right side: Auth buttons & Mobile menu toggle */}
            <div className="flex items-center">
              <div className="hidden md:block">
                  {session ? (
                   <div className="relative">
                     <button onClick={() => signOut({ callbackUrl: "/" })} className="px-4 py-2 text-sm font-mono font-bold bg-gradient-to-r from-red-600 to-red-500 rounded-xl border border-red-400/20 hover:from-red-700 hover:to-red-600 transition-all">
                       Logout
                     </button>
                   </div>
                ) : (
                  <button
                    onClick={() => setLoginModalOpen(true)}
                    className="px-4 py-2 text-sm font-mono font-bold bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl border border-purple-400/20 hover:from-purple-700 hover:to-purple-600 transition-all"
                  >
                    Login
                  </button>
                )}
              </div>
              <div className="md:hidden">
                <button
                  onClick={() => setMenuOpen(!isMenuOpen)}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                    {isMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                    )}
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="md:hidden overflow-hidden bg-black/50 backdrop-blur-xl border-t border-white/10"
            >
              <div className="px-4 pt-2 pb-4 space-y-1">
                {navLinks.map(({ href, label, auth, admin }) => {
                    if ((auth && !session) || (admin && session?.user?.role !== 'admin')) {
                      return null;
                    }
                    const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      className={`block px-4 py-2.5 rounded-xl text-sm font-mono font-medium transition-all border ${
                        isActive
                          ? "bg-purple-600/20 text-purple-300 border-purple-400/30"
                          : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
                 <div className="pt-3 border-t border-white/10 space-y-1">
                  {session ? (
                    <button onClick={() => {signOut({ callbackUrl: "/" }); setMenuOpen(false);}} className="w-full px-4 py-2.5 rounded-xl text-sm font-mono font-bold bg-gradient-to-r from-red-600 to-red-500 border border-red-400/20 hover:from-red-700 hover:to-red-600 transition-all text-white">
                      Logout
                    </button>
                  ) : (
                    <button
                      onClick={() => {setLoginModalOpen(true); setMenuOpen(false);}}
                      className="w-full px-4 py-2.5 rounded-xl text-sm font-mono font-bold bg-gradient-to-r from-purple-600 to-purple-500 border border-purple-400/20 hover:from-purple-700 hover:to-purple-600 transition-all text-white"
                    >
                      Login
                    </button>
                  )}
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      
      {/* Modals */}
      <Modal isOpen={isLoginModalOpen} onClose={() => setLoginModalOpen(false)} title="Sign In">
        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoggingIn}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-mono text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoggingIn}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-mono text-white outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-500"
          />
          <div className="flex justify-between items-center">
            <span className="text-sm font-mono text-gray-400">Don't have an account? Contact an admin</span>
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl text-sm font-mono font-bold border border-purple-400/20 hover:from-purple-700 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoggingIn ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default NavbarComponent;
