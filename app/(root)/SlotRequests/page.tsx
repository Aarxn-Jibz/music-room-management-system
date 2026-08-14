"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import SlotsRequestsTable from "../../../components/ui/SlotsRequestTable";
import { useSession } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { MotionWrapper } from "@/components/ui/MotionWrapper";

// Import Navbar dynamically with no SSR
const Navbar = dynamic(() => import("@/components/Navbar"), {
  ssr: false,
  loading: () => (
    <div className="h-[64px] w-full bg-background/60 backdrop-blur-lg" />
  ),
});

const SlotRequestsPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === "loading") return;

    // 2) If not signed in or not admin, kick them back to home
    if (!session) {
      router.replace("/");
    }
  }, [session, status, router]);
  
  if (status === "loading" || !session) {
    return null;
  }
  
  return (
    <MotionWrapper className="bg-black-100">
      <Navbar aria-label="Main Navigation" />
      <main className="relative bg-black-100 flex justify-center items-center flex-col mx-auto px-4 sm:px-10 min-h-screen">
        <div className="w-full pt-20">
          <SlotsRequestsTable isAdmin={session.user.role === "admin"} userId={session.user.id!} />
        </div>
      </main>
    </MotionWrapper>
  );
};

export default SlotRequestsPage;
