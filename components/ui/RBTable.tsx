"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import axios from "axios";
import { useSession } from "@/lib/auth";
import { FaCalendarAlt, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import Modal from "./Modal";
import ProfileDropdown from "./ProfileDropdown";
import RoomDropdown from "./RoomDropdown";
import DatePicker from "./DatePicker";

// Interfaces
interface Slot {
  id: number;
  slot_start: Date;
  slot_end: Date;
  status: string;
  band_id?: string;
  band_name?: string;
}
interface Bookings { [key: string]: string; }
interface Day { key: string; display: string; }
interface TimeSlot { key: string; display: string; end: string; }
interface SlotConfig { id: string; start_time: string; end_time: string; enabled: boolean; }
export type RequestType = { id: string; user_id: string; status: "approved" | "denied" | "pending"; slot_start: string; slot_end: string; request_date: string; response_date: string | null; user_name?: string; band_name?: string; };
interface WeekCacheEntry {
  slots: Slot[];
  days: Day[];
  bookings: Bookings;
}

// Utility functions
const formatDayKey = (date: Date): string => format(date, "yyyy-MM-dd");
const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const RBTable = () => {
  const { data: session } = useSession();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Bookings>({});
  const [days, setDays] = useState<Day[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()));
  const [roomMapping, setRoomMapping] = useState<{ [key: number]: string }>({});
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<number>(365);
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [bands, setBands] = useState<Array<{ id: string; name: string; colour: string }>>([]);
  const [bandColors, setBandColors] = useState<{ [key: string]: string }>({});
  const isAdmin = session?.user?.role === "admin";

  const [selectedCell, setSelectedCell] = useState<{ day: string, time: string} | null>(null);
  const [modalTime, setModalTime] = useState("");
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const timeDropdownRef = useRef<HTMLDivElement>(null);
  const weekCache = useRef<Map<string, WeekCacheEntry>>(new Map());
  const skipAnimation = useRef(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [isTableScrolled, setIsTableScrolled] = useState(false);
  const MAX_CACHE = 20;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedBandId, setSelectedBandId] = useState<string>("");
  const [dataReady, setDataReady] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [roomsRes, bandsRes, slotConfigsRes] = await Promise.all([
          axios.get("/api/rooms"),
          axios.get("/api/bands"),
          axios.get("/api/slotconfig"),
        ]);

        const mapping: { [key: number]: string } = {};
        roomsRes.data.forEach((room: { id: string; number: number }) => {
          mapping[room.number] = room.id;
        });
        setRoomMapping(mapping);

        const allBands = bandsRes.data as Array<{ id: string; name: string; colour: string }>;
        setBands(allBands);
        const coloursMap: { [key: string]: string } = {};
        allBands.forEach((b) => { coloursMap[b.id] = b.colour; });
        setBandColors(coloursMap);

        const configs: SlotConfig[] = slotConfigsRes.data
          .filter((config: SlotConfig) => config.enabled)
          .sort((a: SlotConfig, b: SlotConfig) => a.start_time.localeCompare(b.start_time));
        
        const formattedConfigs: TimeSlot[] = configs.map((config) => {
          const startDate = new Date(`1970-01-01T${config.start_time}`);
          const endDate = new Date(`1970-01-01T${config.end_time}`);
          return {
            key: config.start_time.substring(0, 5),
            display: startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h12" }),
            end: endDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h12" }),
          };
        });
        setTimeSlots(formattedConfigs);

        setDataReady(true);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };
    if (!dataReady) fetchInitialData();
  }, [session, isAdmin, dataReady]);

  useEffect(() => {
    if (session?.user && !isAdmin) {
        setSelectedBandId((session.user as any).band_id || "");
    }
  }, [session, isAdmin]);

  useEffect(() => {
    const roomNumbers = Object.keys(roomMapping).map(Number);
    if (roomNumbers.length > 0 && !roomNumbers.includes(selectedRoomNumber)) {
      setSelectedRoomNumber(roomNumbers[0]);
    }
  }, [roomMapping, selectedRoomNumber]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(e.target as Node)) setShowTimeDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTableScroll = useCallback(() => {
    const el = tableScrollRef.current;
    if (el) {
      setIsTableScrolled(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    }
  }, []);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!dataReady) return;

      skipAnimation.current = false;
      const cacheKey = `${formatDayKey(currentWeekStart)}-${selectedRoomNumber}`;
      const cached = weekCache.current.get(cacheKey);
      if (cached) {
        skipAnimation.current = true;
        setSlots(cached.slots);
        setDays(cached.days);
        setBookings(cached.bookings);
        return;
      }

      setLoadingSlots(true);

      const rangeStart = new Date(currentWeekStart);
      const rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeEnd.getDate() + 7);

      try {
        const response = await axios.get("/api/slots", {
          params: {
            start: rangeStart.toISOString(),
            end: rangeEnd.toISOString(),
            roomNumber: selectedRoomNumber,
          },
        });

        const fetchedSlots: Slot[] = response.data;
        setSlots(fetchedSlots);

        const weekDays = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(currentWeekStart);
          d.setDate(d.getDate() + i);
          return {
            key: formatDayKey(d),
            display: `${format(d, "EEE")} ${format(d, "dd MMM")}`,
          };
        });
        setDays(weekDays);

        const newBookings: Bookings = {};
        weekDays.forEach(day => {
            timeSlots.forEach(time => {
                const key = `${day.key}-${time.key}`;
                newBookings[key] = "available";
            });
        });

        fetchedSlots.forEach(slot => {
            const slotStart = new Date(slot.slot_start);
            const dayKey = format(slotStart, "yyyy-MM-dd");
            const timeKey = `${String(slotStart.getUTCHours()).padStart(2, '0')}:${String(slotStart.getUTCMinutes()).padStart(2, '0')}`;
            const bookingKey = `${dayKey}-${timeKey}`;
            if(newBookings[bookingKey]) {
                newBookings[bookingKey] = slot.status;
            }
        });
        setBookings(newBookings);

        weekCache.current.set(cacheKey, { slots: fetchedSlots, days: weekDays, bookings: newBookings });
        if (weekCache.current.size > MAX_CACHE) {
          const firstKey = weekCache.current.keys().next().value!;
          weekCache.current.delete(firstKey);
        }
      } catch (error) {
        console.error("Error fetching slots:", error);
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [currentWeekStart, selectedRoomNumber, dataReady]);


  const handleCellClick = (dayKey: string, timeKey: string) => {
    if (!session) {
        setModalTitle("Login Required");
        setModalContent(<p className="text-gray-400">You must be logged in to book a slot.</p>);
        setModalOpen(true);
        return;
    }

    const bookingStatus = bookings[`${dayKey}-${timeKey}`];
    if (bookingStatus === 'booked') {
        setModalTitle("Slot Unavailable");
        setModalContent(<p className="text-gray-400">This slot is already booked.</p>);
        setModalOpen(true);
        return;
    }

    setSelectedCell({ day: dayKey, time: timeKey });
    setModalTime(timeKey);
    setModalTitle("Request Slot");
    setModalOpen(true);
  };

  const handleBookingConfirm = async () => {
    if (!selectedCell || !selectedBandId || isSubmitting) return;

    setIsSubmitting(true);
    const { day } = selectedCell;
    const slotStart = new Date(`${day}T${modalTime}:00Z`);
    const slotEnd = new Date(slotStart.getTime() + 90 * 60 * 1000);

    try {
        await axios.post("/api/requests", {
            user_id: session?.user?.id,
            status: "pending",
            slot_start: slotStart.toISOString(),
            slot_end: slotEnd.toISOString(),
            band_id: selectedBandId,
            room_id: roomMapping[selectedRoomNumber],
            reason,
        });
        weekCache.current.clear();
        setModalTitle("Request Submitted");
        setModalContent(<p className="text-gray-400">Your request has been submitted for approval.</p>);
    } catch (error: any) {
        setModalTitle("Error");
        setModalContent(<p className="text-red-400">{error.response?.data?.message || "An unexpected error occurred."}</p>);
    } finally {
        setIsSubmitting(false);
    }
  };

  const mergeInfo = useMemo(() => {
    const info: { [key: string]: { rowSpan: number; hidden: boolean; bandName: string; bandId: string } } = {};
    days.forEach(day => {
      let i = 0;
      while (i < timeSlots.length) {
        const time = timeSlots[i];
        const cellKey = `${day.key}-${time.key}`;
        const status = bookings[cellKey];
        const slot = slots.find(s => {
          const start = new Date(s.slot_start);
          const tKey = `${String(start.getUTCHours()).padStart(2, '0')}:${String(start.getUTCMinutes()).padStart(2, '0')}`;
          return formatDayKey(start) === day.key && tKey === time.key;
        });
        if (status === 'booked' && slot) {
          let count = 1;
          while (i + count < timeSlots.length) {
            const next = timeSlots[i + count];
            const nextKey = `${day.key}-${next.key}`;
            const nextStatus = bookings[nextKey];
            const nextSlot = slots.find(s => {
              const start = new Date(s.slot_start);
              const tKey = `${String(start.getUTCHours()).padStart(2, '0')}:${String(start.getUTCMinutes()).padStart(2, '0')}`;
              return formatDayKey(start) === day.key && tKey === next.key;
            });
            if (nextStatus === 'booked' && nextSlot && nextSlot.band_id === slot.band_id) {
              count++;
            } else break;
          }
          for (let j = 0; j < count; j++) {
            const t = timeSlots[i + j];
            info[`${day.key}-${t.key}`] = {
              rowSpan: j === 0 ? count : 0,
              hidden: j > 0,
              bandName: slot.band_name || "Booked",
              bandId: slot.band_id!,
            };
          }
          i += count;
        } else {
          info[cellKey] = { rowSpan: 1, hidden: false, bandName: "", bandId: "" };
          i++;
        }
      }
    });
    return info;
  }, [slots, days, timeSlots, bookings]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl text-white w-full h-full flex flex-col shadow-2xl relative"
    >
      {loadingSlots && (
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-3xl overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-600 via-purple-400 to-purple-600"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
          />
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-400 uppercase tracking-widest">Room</span>
          <RoomDropdown value={selectedRoomNumber} onChange={setSelectedRoomNumber} rooms={Object.keys(roomMapping).map(Number)} />
        </div>

        <div className="flex items-center gap-1 sm:gap-2 p-1 bg-white/5 rounded-full border border-white/10">
            <button 
                onClick={() => setCurrentWeekStart(getMonday(new Date()))} 
                className="px-3 sm:px-4 py-2 text-xs font-bold uppercase rounded-full hover:bg-white/10 transition-colors"
            >
                <span className="hidden sm:inline">Today</span>
                <span className="sm:hidden">Now</span>
            </button>
            <div className="w-px h-4 bg-white/20 mx-1" />
            <button 
                onClick={() => { setSelectedCell(null); setModalTitle("Select Week"); setModalOpen(true); }} 
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-purple-400"
                title="Select Date"
            >
                <FaCalendarAlt />
            </button>
            <button 
                onClick={() => setCurrentWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })} 
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
                <FaChevronLeft />
            </button>
            <button 
                onClick={() => setCurrentWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })} 
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
                <FaChevronRight />
            </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loadingSlots ? (
          <motion.div
            key="spinner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="flex flex-col items-center justify-center gap-5 py-20 text-gray-400"
          >
            <motion.svg
              className="w-8 h-8 text-purple-400/80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            >
              <path d="M6.5 4h11v2.5L13 12l4.5 5.5V20h-11v-2.5L11 12 6.5 6.5V4z" />
              <path d="M8 14.5h8" strokeWidth="1" />
            </motion.svg>
            <span className="text-sm font-medium">Loading schedule...</span>
          </motion.div>
        ) : (
        <motion.div
          key={`${formatDayKey(currentWeekStart)}-${selectedRoomNumber}`}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
        >
        {/* Table Container */}
        <div className="relative">
          <div
            ref={tableScrollRef}
            onScroll={handleTableScroll}
            className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]"
          >
        <table className="w-full text-center border-collapse">
              <thead>
                  <tr className="bg-white/5">
                      <th className="p-2 sm:p-4 text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-white/10">Time</th>
                      {days.map((day, i) => (
                          <th key={day.key} className="p-2 sm:p-4 text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-white/10">
                              <motion.span
                                key={formatDayKey(currentWeekStart)}
                                initial={skipAnimation.current ? false : { opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + i * 0.03, duration: 0.2 }}
                              >
                                  {day.display}
                              </motion.span>
                          </th>
                      ))}
                  </tr>
              </thead>
              <motion.tbody key={`${formatDayKey(currentWeekStart)}-${selectedRoomNumber}`}>
                      {timeSlots.map((time, rowIdx) => (
                          <motion.tr 
                              key={time.key} 
                              initial={skipAnimation.current ? false : { opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: rowIdx * 0.03, duration: 0.25 }}
                              layout
                              className="group hover:bg-white/[0.03] transition-colors"
                          >
                              <td className="p-4 border-b border-white/10 font-mono text-sm text-gray-500 group-hover:text-gray-300 transition-colors leading-tight">
                                  <span className="whitespace-nowrap">{time.display}</span>
                                  <span className="block text-center text-xs font-bold opacity-50">—</span>
                                  <span className="whitespace-nowrap">{time.end}</span>
                              </td>
                              {days.map(day => {
                                  const cellKey = `${day.key}-${time.key}`;
                                  const merge = mergeInfo[cellKey];
                                  if (merge?.hidden) return null;

                                  const bookingStatus = bookings[cellKey];
                                  const isBooked = bookingStatus === 'booked' && !!merge?.bandId;
                                  const isMerged = (merge?.rowSpan || 1) > 1;

                                  let cellContent = "Available";
                                  let cellClassName = "cursor-pointer transition-all duration-200 text-gray-500 hover:text-purple-300";
                                  let cellStyle: React.CSSProperties = {};

                                  if (isBooked) {
                                      cellContent = merge!.bandName;
                                      cellClassName = "font-bold text-white shadow-sm";
                                      cellStyle = {
                                          backgroundColor: bandColors[merge!.bandId] || '#4A5568',
                                          boxShadow: `0 0 15px ${bandColors[merge!.bandId] || '#4A5568'}44`
                                      };
                                  } else {
                                      cellClassName += " hover:bg-purple-500/10";
                                  }

                                  let divClasses = "rounded-lg transition-all";
                                  let bookedDiv = false;
                                  if (isBooked) {
                                      bookedDiv = true;
                                      if (isMerged) {
                                          divClasses += " absolute inset-2 flex items-center justify-center";
                                      } else {
                                          divClasses += " py-2 px-1 w-full";
                                      }
                                  } else {
                                      divClasses += " py-2 px-1 group-hover:scale-105";
                                  }
                                  
                                  return (
                                      <td 
                                          key={cellKey}
                                          rowSpan={merge?.rowSpan || 1}
                                          onClick={() => handleCellClick(day.key, time.key)} 
                                           className={`p-2 border-b border-white/10 font-mono transition-all relative ${cellClassName}`}
                                      >
                                          {isMerged && isBooked ? (
                                              <>
                                                  <motion.div layout={bookedDiv} className={divClasses} style={cellStyle} />
                                                  <span className="relative z-10 text-xs text-white">{cellContent}</span>
                                              </>
                                          ) : (
                                              <motion.div layout={bookedDiv} style={cellStyle} className={divClasses}>
                                                  <span className={`text-xs ${isBooked ? 'text-white' : 'text-gray-500 group-hover:text-purple-400'}`}>
                                                      {cellContent}
                                                  </span>
                                              </motion.div>
                                          )}
                                      </td>
                                  );
                              })}
                          </motion.tr>
                      ))}
              </motion.tbody>
          </table>
          </div>
          {isTableScrolled && (
            <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-black-100/80 via-black-100/40 to-transparent pointer-events-none rounded-r-2xl" />
          )}
        </div>
        </motion.div>
        )}
      </AnimatePresence>

      {/* Modal */}
        <Modal isOpen={isModalOpen} onClose={() => { setModalOpen(false); setShowTimeDropdown(false); }} title={modalTitle}>
            { selectedCell && modalTitle === "Request Slot" ? (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-start">
                        <div className="space-y-2 flex-1">
                            <label className="text-xs font-bold text-gray-400 uppercase font-mono">Date</label>
                            <div className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-mono">
                                {days.find(d => d.key === selectedCell.day)?.display || selectedCell.day}
                            </div>
                        </div>
                        <div className="space-y-2 flex-1 relative" ref={timeDropdownRef}>
                            <label className="text-xs font-bold text-gray-400 uppercase font-mono">Time</label>
                            <button
                                type="button"
                                onClick={() => setShowTimeDropdown(o => !o)}
                                className="w-full flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-mono hover:bg-white/20 transition-all outline-none text-white"
                            >
                                <span>{timeSlots.find(s => s.key === modalTime)?.display || modalTime}</span>
                                <svg className={`w-3 h-3 text-gray-400 transition-transform ml-auto ${showTimeDropdown ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {showTimeDropdown && (
                                <div className="absolute z-50 mt-2 left-0 right-0 bg-gray-900/70 backdrop-blur-xl border border-white/20 rounded-xl p-2 shadow-2xl shadow-black/50 max-h-48 overflow-y-auto">
                                    {timeSlots.map(slot => (
                                        <button
                                            key={slot.key}
                                            onClick={() => { setModalTime(slot.key); setShowTimeDropdown(false); }}
                                            className={`w-full text-left px-3 py-2 text-sm font-mono rounded-lg hover:bg-white/10 transition-colors ${modalTime === slot.key ? 'text-purple-300 bg-white/10' : 'text-gray-300'}`}
                                        >
                                            {slot.display}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    {isAdmin && (
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-gray-400 uppercase font-mono">Select Profile</label>
                             <ProfileDropdown value={selectedBandId} onChange={setSelectedBandId} bands={bands} />
                         </div>
                    )}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase font-mono">Reason</label>
                        <textarea 
                            value={reason} 
                            onChange={e => setReason(e.target.value)} 
                            placeholder="Why do you need this slot?" 
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm font-mono h-24 outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                        />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button 
                            onClick={handleBookingConfirm} 
                            disabled={isSubmitting || !selectedBandId} 
                            className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white text-sm font-mono font-bold rounded-xl border border-purple-400/20 hover:from-purple-700 hover:to-purple-600 hover:border-purple-400/40 disabled:from-purple-950/60 disabled:to-purple-900/50 disabled:text-purple-300/60 disabled:border-purple-500/20 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-[0.98]"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Submitting...
                                </span>
                            ) : "Submit Request"}
                        </button>
                    </div>
                </div>
            ) : modalTitle === "Select Week" || (modalContent === null && !modalTitle.includes("Required") && !modalTitle.includes("Unavailable")) ? (
                <div className="py-2">
                    <DatePicker
                        selected={currentWeekStart}
                        onSelect={(date) => {
                            setCurrentWeekStart(getMonday(date));
                            setModalOpen(false);
                        }}
                    />
                </div>
            ) : (
                <div className="py-8 text-center">
                    {modalContent}
                </div>
            )}
      </Modal>
    </motion.div>
  );
};

export default RBTable;
