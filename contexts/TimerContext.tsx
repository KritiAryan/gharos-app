import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { AppState } from "react-native";

type TimerState = {
  active: boolean;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  paused: boolean;
};

type TimerContextType = {
  timer: TimerState;
  startTimer: (label: string, seconds: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
};

const INITIAL: TimerState = {
  active: false,
  label: "",
  totalSeconds: 0,
  remainingSeconds: 0,
  paused: false,
};

const TimerContext = createContext<TimerContextType>({
  timer: INITIAL,
  startTimer: () => {},
  pauseTimer: () => {},
  resumeTimer: () => {},
  stopTimer: () => {},
});

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timer, setTimer] = useState<TimerState>(INITIAL);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bgTimeRef = useRef<number>(0);

  // Tick down every second
  useEffect(() => {
    if (timer.active && !timer.paused && timer.remainingSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev.remainingSeconds <= 1) {
            // Timer finished
            clearInterval(intervalRef.current!);
            return { ...prev, remainingSeconds: 0, active: false };
          }
          return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timer.active, timer.paused, timer.remainingSeconds > 0]);

  // Handle app going to background — track elapsed time
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        bgTimeRef.current = Date.now();
      } else if (state === "active" && bgTimeRef.current > 0 && timer.active && !timer.paused) {
        const elapsed = Math.floor((Date.now() - bgTimeRef.current) / 1000);
        bgTimeRef.current = 0;
        setTimer((prev) => ({
          ...prev,
          remainingSeconds: Math.max(0, prev.remainingSeconds - elapsed),
          active: prev.remainingSeconds - elapsed > 0,
        }));
      }
    });
    return () => sub.remove();
  }, [timer.active, timer.paused]);

  const startTimer = useCallback((label: string, seconds: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimer({ active: true, label, totalSeconds: seconds, remainingSeconds: seconds, paused: false });
  }, []);

  const pauseTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimer((prev) => ({ ...prev, paused: true }));
  }, []);

  const resumeTimer = useCallback(() => {
    setTimer((prev) => ({ ...prev, paused: false }));
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTimer(INITIAL);
  }, []);

  return (
    <TimerContext.Provider value={{ timer, startTimer, pauseTimer, resumeTimer, stopTimer }}>
      {children}
    </TimerContext.Provider>
  );
}

export const useTimer = () => useContext(TimerContext);
