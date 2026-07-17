"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const VIDEO_DESKTOP = "/Priimo%20Video5.mp4";
const VIDEO_MOBILE = "/Priimo%20Videeo.mp4";
const MOBILE_MEDIA = "(max-width: 767px)";
const CONTROL_COLOR = "#6366F1";
const MAGNETIC_MAX = 58;
const BUTTON_FADE_MS = 220;

/** Vidéo hero : aperçu de la 1re frame, lecture manuelle via bouton central ou clic sur la vidéo. */
export default function HeroVideo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const buttonWrapRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [iconMode, setIconMode] = useState<"play" | "pause">("play");
  const [isMobile, setIsMobile] = useState(false);
  const pendingPlayRef = useRef(false);
  const targetOffsetRef = useRef({ x: 0, y: 0 });
  const currentOffsetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const videoSrc = isMobile ? VIDEO_MOBILE : VIDEO_DESKTOP;

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MEDIA);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setIconMode("play");
    setIsReady(false);
    pendingPlayRef.current = false;
  }, [videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      setIconMode("play");
    };
    const onEnded = () => {
      setIsPlaying(false);
      setIconMode("play");
    };

    const primeFirstFrame = () => {
      setIsReady(true);
      if (!pendingPlayRef.current && video.paused) {
        video.currentTime = 0.01;
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("loadeddata", primeFirstFrame);

    if (video.readyState >= 2) primeFirstFrame();

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("loadeddata", primeFirstFrame);
    };
  }, [videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !pendingPlayRef.current) return;

    const startPlayback = () => {
      pendingPlayRef.current = false;
      void video.play().catch(() => {
        setIsPlaying(false);
        setIconMode("play");
      });
    };

    if (video.readyState >= 2) {
      startPlayback();
      return;
    }

    video.addEventListener("loadeddata", startPlayback, { once: true });
    return () => video.removeEventListener("loadeddata", startPlayback);
  }, [isReady, videoSrc]);

  useEffect(() => {
    const container = containerRef.current;
    const wrap = buttonWrapRef.current;
    if (!container || !wrap) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (reduceMotion || coarsePointer) return;

    const applyTransform = () => {
      const { x, y } = currentOffsetRef.current;
      wrap.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    };

    const tick = () => {
      if (isPlaying) {
        targetOffsetRef.current = { x: 0, y: 0 };
      }

      const current = currentOffsetRef.current;
      const target = targetOffsetRef.current;
      current.x += (target.x - current.x) * 0.22;
      current.y += (target.y - current.y) * 0.22;

      if (Math.abs(target.x - current.x) < 0.05 && Math.abs(target.y - current.y) < 0.05) {
        current.x = target.x;
        current.y = target.y;
      }

      applyTransform();
      rafRef.current = requestAnimationFrame(tick);
    };

    const onMove = (event: MouseEvent) => {
      if (isPlaying) return;

      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const relX = (event.clientX - centerX) / (rect.width / 2);
      const relY = (event.clientY - centerY) / (rect.height / 2);
      targetOffsetRef.current = {
        x: Math.max(-1, Math.min(1, relX)) * MAGNETIC_MAX,
        y: Math.max(-1, Math.min(1, relY)) * MAGNETIC_MAX,
      };
    };

    const onLeave = () => {
      targetOffsetRef.current = { x: 0, y: 0 };
    };

    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      targetOffsetRef.current = { x: 0, y: 0 };
      currentOffsetRef.current = { x: 0, y: 0 };
    };
  }, [isPlaying]);

  async function startPlayback() {
    const video = videoRef.current;
    if (!video || !video.paused) return;

    setIconMode("pause");
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    pendingPlayRef.current = true;
    if (video.readyState >= 2) {
      pendingPlayRef.current = false;
      try {
        await video.play();
      } catch {
        setIsPlaying(false);
        setIconMode("play");
      }
    }
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await startPlayback();
      return;
    }

    video.pause();
  }

  function handleContainerClick() {
    void togglePlayback();
  }

  function handleContainerKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void togglePlayback();
    }
  }

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      onClick={handleContainerClick}
      onKeyDown={handleContainerKeyDown}
      aria-label={isPlaying ? "Mettre la démo en pause" : "Lire la démo Priimo"}
      className="relative aspect-video w-full cursor-pointer overflow-hidden bg-gradient-to-br from-[#f3f4fb] via-[#eef0f8] to-[#e8ebf6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6366F1]"
    >
      <video
        key={videoSrc}
        ref={videoRef}
        className={`pointer-events-none block h-full w-full object-cover transition-opacity duration-300 ${isReady ? "opacity-100" : "opacity-0"}`}
        src={videoSrc}
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden
      />

      <div
        ref={buttonWrapRef}
        className={`pointer-events-none absolute left-1/2 top-1/2 z-10 will-change-transform transition-opacity ease-out motion-reduce:transition-none ${
          isPlaying ? "opacity-0" : "opacity-100"
        }`}
        style={{
          transform: "translate(-50%, -50%)",
          transitionDuration: isPlaying ? `${BUTTON_FADE_MS}ms` : "300ms",
        }}
        aria-hidden
      >
        <span
          className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full text-white shadow-[0_14px_36px_-10px_rgba(99,102,241,0.6)] sm:h-[4.75rem] sm:w-[4.75rem]"
          style={{ backgroundColor: CONTROL_COLOR }}
        >
          {iconMode === "pause" ? (
            <Pause size={30} strokeWidth={2.25} fill="currentColor" aria-hidden />
          ) : (
            <Play size={30} strokeWidth={2.25} fill="currentColor" className="ml-1" aria-hidden />
          )}
        </span>
      </div>
    </div>
  );
}
