"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const VIDEO_DESKTOP = "/Priimo%20Video5.mp4";
const VIDEO_MOBILE = "/Priimo%20Videeo.mp4";
const MOBILE_MEDIA = "(max-width: 767px)";
const CONTROL_COLOR = "#6366F1";
const MAGNETIC_MAX = 58;
const BUTTON_FADE_MS = 220;
const TIMELINE_FADE_MS = 220;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/** Vidéo hero : aperçu de la 1re frame, lecture manuelle via bouton central ou clic sur la vidéo. */
export default function HeroVideo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const buttonWrapRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [iconMode, setIconMode] = useState<"play" | "pause">("play");
  const [isMobile, setIsMobile] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isTimelineFocused, setIsTimelineFocused] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const pendingPlayRef = useRef(false);
  const targetOffsetRef = useRef({ x: 0, y: 0 });
  const currentOffsetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const progressRafRef = useRef<number | null>(null);
  const isScrubbingRef = useRef(false);
  const videoSrc = isMobile ? VIDEO_MOBILE : VIDEO_DESKTOP;
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const showTimeline = isCoarsePointer || isHovered || isScrubbing || isTimelineFocused;

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MEDIA);
    const pointerMq = window.matchMedia("(pointer: coarse)");
    const update = () => {
      setIsMobile(mq.matches);
      setIsCoarsePointer(pointerMq.matches);
    };
    update();
    mq.addEventListener("change", update);
    pointerMq.addEventListener("change", update);
    return () => {
      mq.removeEventListener("change", update);
      pointerMq.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setIconMode("play");
    setIsReady(false);
    setCurrentTime(0);
    setDuration(0);
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
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => {
      if (Number.isFinite(video.duration)) setDuration(video.duration);
    };

    const primeFirstFrame = () => {
      setIsReady(true);
      onDurationChange();
      if (!pendingPlayRef.current && video.paused) {
        video.currentTime = 0.01;
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onDurationChange);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("loadeddata", primeFirstFrame);

    if (video.readyState >= 2) primeFirstFrame();

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onDurationChange);
      video.removeEventListener("durationchange", onDurationChange);
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying) return;

    const tick = () => {
      if (!isScrubbingRef.current) {
        setCurrentTime(video.currentTime);
      }
      progressRafRef.current = requestAnimationFrame(tick);
    };

    progressRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (progressRafRef.current !== null) {
        cancelAnimationFrame(progressRafRef.current);
      }
    };
  }, [isPlaying, videoSrc]);

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

  function handleContainerMouseEnter() {
    setIsHovered(true);
  }

  function handleContainerMouseLeave() {
    setIsHovered(false);
  }

  function handleSeek(value: number) {
    const video = videoRef.current;
    if (!video || !duration) return;
    const next = Math.min(duration, Math.max(0, value));
    video.currentTime = next;
    setCurrentTime(next);
  }

  function seekFromClientX(clientX: number, track: HTMLElement) {
    if (!duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    handleSeek(ratio * duration);
  }

  function handleProgressPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (!duration) return;
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromClientX(event.clientX, event.currentTarget);
  }

  function handleProgressPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!isScrubbingRef.current) return;
    event.stopPropagation();
    seekFromClientX(event.clientX, event.currentTarget);
  }

  function handleProgressPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!isScrubbingRef.current) return;
    event.stopPropagation();
    isScrubbingRef.current = false;
    setIsScrubbing(false);
    event.currentTarget.releasePointerCapture(event.pointerId);

    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const { clientX, clientY } = event;
      const inside =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;
      if (!inside) setIsHovered(false);
    }
  }

  function handleTimelineFocus() {
    setIsTimelineFocused(true);
  }

  function handleTimelineBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsTimelineFocused(false);
    }
  }

  function handleProgressKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (!duration) return;
    const step = event.shiftKey ? 10 : 5;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      handleSeek(currentTime + step);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      handleSeek(currentTime - step);
    } else if (event.key === "Home") {
      event.preventDefault();
      handleSeek(0);
    } else if (event.key === "End") {
      event.preventDefault();
      handleSeek(duration);
    }
  }

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        role="button"
        tabIndex={0}
        onClick={handleContainerClick}
        onKeyDown={handleContainerKeyDown}
        onMouseEnter={handleContainerMouseEnter}
        onMouseLeave={handleContainerMouseLeave}
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

        <div
          className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-4 pb-3 pt-10 transition-opacity ease-out motion-reduce:transition-none sm:px-5 sm:pb-3.5 sm:pt-12 ${
            showTimeline ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          style={{ transitionDuration: `${TIMELINE_FADE_MS}ms` }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onFocus={handleTimelineFocus}
          onBlur={handleTimelineBlur}
        >
          <div
            className={`flex items-center gap-2.5 sm:gap-3 ${
              showTimeline ? "pointer-events-auto" : "pointer-events-none"
            }`}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className="w-9 shrink-0 text-[10px] font-medium tabular-nums text-white/85 sm:text-[11px]">
              {formatTime(currentTime)}
            </span>

            <div
              role="slider"
              tabIndex={duration ? 0 : -1}
              aria-label="Position dans la vidéo"
              aria-valuemin={0}
              aria-valuemax={duration || 0}
              aria-valuenow={currentTime}
              aria-valuetext={`${formatTime(currentTime)} sur ${formatTime(duration)}`}
              aria-disabled={!duration}
              className="group relative h-5 flex-1 cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-default"
              onPointerDown={handleProgressPointerDown}
              onPointerMove={handleProgressPointerMove}
              onPointerUp={handleProgressPointerUp}
              onPointerCancel={handleProgressPointerUp}
              onKeyDown={handleProgressKeyDown}
            >
              <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full origin-left rounded-full bg-[#6366F1] will-change-transform"
                  style={{ transform: `scaleX(${progressRatio})` }}
                />
              </div>
              <div
                className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-[0_0_0_2px_rgba(99,102,241,0.85)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                style={{ left: `${progressRatio * 100}%` }}
                aria-hidden
              />
            </div>

            <span className="w-9 shrink-0 text-right text-[10px] font-medium tabular-nums text-white/85 sm:text-[11px]">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
