import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Holding } from '../types/wealth';
import { formatCurrency } from '../utils/currency';
import { VestoraLogo } from './VestoraLogo';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  DoorOpen,
  Landmark,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface StreetStoryGameProps {
  holdings: Holding[];
  onEnterLiveRebalance: () => void;
  onOpenOverview: () => void;
  onOpenValidateModal: () => void;
}

type StoryMode = 'GAME' | 'MOVIE';
type StopId = 'START' | 'SITES' | 'ADVISOR' | 'WEALTH_MGR' | 'VESTORA_DOOR' | 'VESTORA_INSIDE';

interface StreetBuilding {
  id: Exclude<StopId, 'START' | 'VESTORA_INSIDE'>;
  x: number;
  width: number;
  height: number;
  name: string;
  signTop: string;
  signSub: string;
  badgeText: string;
  accentColor: string;
  visitedStress: number;
  speaker: string;
  dialogue: string;
  investorThought: string;
  paperSlip: string;
}

const WORLD_WIDTH = 2500;
const INVESTOR_MIN_X = 90;
const INVESTOR_MAX_X = 2240;

const BUILDINGS: StreetBuilding[] = [
  {
    id: 'SITES',
    x: 340,
    width: 275,
    height: 210,
    name: 'Finance Websites & Forums',
    signTop: 'FINANCE SITES',
    signSub: '47 OPEN TABS · GENERIC TIPS',
    badgeText: 'STOP 01 · FINANCE SITES',
    accentColor: '#64748b',
    visitedStress: 68,
    speaker: 'Conflicting Blogs & Calculators',
    dialogue:
      '"Article 1 screams 100% Small-Cap Equity. Article 2 warns Stick to Safe FDs. None of these calculators see your existing mutual funds, matured deposits, tax slab, or active 8.55% home loan together."',
    investorThought:
      '"47 open tabs and five spreadsheets later, I still don’t know where to rebalance MY money."',
    paperSlip: '47 Contradictory Web Articles',
  },
  {
    id: 'ADVISOR',
    x: 885,
    width: 285,
    height: 220,
    name: 'Commission Sales Advisors',
    signTop: 'SALES ADVISOR',
    signSub: 'REGULAR PLANS · HIGH COMMISSION',
    badgeText: 'STOP 02 · COMMISSION ADVISOR',
    accentColor: '#f59e0b',
    visitedStress: 84,
    speaker: 'Commission-Driven Advisor',
    dialogue:
      '"Forget comparing your old FDs or paying down your 8.55% home loan—put fresh cash into our brand-new Sectoral Regular Plan NFO today! (1.8% hidden annual commission built in.)"',
    investorThought:
      '"He didn’t even review my loans or tax drag—he’s just pushing whatever pays him the highest commission."',
    paperSlip: 'Biased Regular NFO Pitch',
  },
  {
    id: 'WEALTH_MGR',
    x: 1445,
    width: 280,
    height: 225,
    name: 'Traditional Wealth Managers',
    signTop: 'WEALTH MANAGER',
    signSub: '1.5% AUM FEE · SILOED VIEW',
    badgeText: 'STOP 03 · WEALTH MANAGER',
    accentColor: '#94a3b8',
    visitedStress: 96,
    speaker: 'Private Wealth Desk',
    dialogue:
      '"We only advise on assets moved into our platform—not your outside bank FDs, EPF, PPF, or loans. And we require a 1.5% annual AUM fee plus uploading all statements to our servers."',
    investorThought:
      '"Partial advice, steep fees, and zero privacy. I’m completely exhausted—why isn’t there ONE fair place for everything?"',
    paperSlip: 'Partial Siloed Pitch + 1.5% Fee',
  },
  {
    id: 'VESTORA_DOOR',
    x: 2020,
    width: 315,
    height: 235,
    name: 'Vestora Wealth',
    signTop: 'VESTORA WEALTH',
    signSub: 'FULL & FAIR ADVICE · 100% ON-DEVICE',
    badgeText: 'STOP 04 · VESTORA ARRIVES',
    accentColor: '#10b981',
    visitedStress: 14,
    speaker: 'Vestora Wealth Portal',
    dialogue:
      '"Take a breath—bring every investment and loan onto one unbiased portal. Zero commissions, zero server uploads. We evaluate your FDs, MFs, stocks, gold, taxes, and 8.55% home loan fairly using live markets."',
    investorThought:
      '"Finally—complete, unbiased clarity across every investment and loan I own, right on my own device!"',
    paperSlip: 'Unified Fair Rebalance Plan',
  },
];

// Gentle synthesized sound effects via Web Audio API (only after user unmutes)
function playTone(
  ctx: AudioContext | null,
  freq: number,
  durationSec: number,
  type: OscillatorType = 'sine',
  gainPeak = 0.04
) {
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  } catch {
    // Ignore audio context errors
  }
}

export const StreetStoryGame: React.FC<StreetStoryGameProps> = ({
  holdings,
  onEnterLiveRebalance,
  onOpenOverview,
  onOpenValidateModal,
}) => {
  const [mode, setMode] = useState<StoryMode>('GAME');
  const [isMoviePlaying, setIsMoviePlaying] = useState<boolean>(false);
  const [movieSpeed, setMovieSpeed] = useState<1 | 1.5>(1);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);

  const [activeStop, setActiveStop] = useState<StopId>('START');
  const [visitedStops, setVisitedStops] = useState<Set<string>>(() => new Set());
  const [stressLevel, setStressLevel] = useState<number>(52);
  const [playerXState, setPlayerXState] = useState<number>(130);
  const [nearbyBuilding, setNearbyBuilding] = useState<StreetBuilding | null>(null);
  const [officeSolved, setOfficeSolved] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Physics / animation refs for smooth 60fps canvas loop
  const keysRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const playerXRef = useRef<number>(130);
  const targetAutoXRef = useRef<number | null>(null);
  const facingRef = useRef<1 | -1>(1);
  const walkPhaseRef = useRef<number>(0);
  const cameraXRef = useRef<number>(0);
  const stressRef = useRef<number>(52);
  const visitedRef = useRef<Set<string>>(new Set());
  const activeStopRef = useRef<StopId>('START');
  const soundEnabledRef = useRef<boolean>(false);
  const lastStepSoundRef = useRef<number>(0);
  const stepSoundPhaseRef = useRef<number>(0);

  useEffect(() => {
    stressRef.current = stressLevel;
  }, [stressLevel]);

  useEffect(() => {
    visitedRef.current = visitedStops;
  }, [visitedStops]);

  useEffect(() => {
    activeStopRef.current = activeStop;
  }, [activeStop]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const ensureAudio = useCallback(() => {
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    return audioCtxRef.current;
  }, []);

  const portfolioSnapshot = useMemo(() => {
    const matured = holdings.find((h) => h.isMatured || (h.daysToMaturity !== undefined && h.daysToMaturity <= 0));
    const cash = holdings.find((h) => h.category === 'SAVINGS_CASH');
    const source = matured ?? cash ?? holdings[0];
    return {
      count: holdings.length,
      maturedName: source?.name ?? 'HDFC Bank Matured Fixed Deposit',
      maturedAmount: source ? formatCurrency(source.currentValue) : '₹6.92L',
    };
  }, [holdings]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next) {
      const ctx = ensureAudio();
      playTone(ctx, 523.25, 0.14, 'triangle', 0.045);
    }
  };

  const visitBuilding = useCallback(
    (building: StreetBuilding) => {
      setActiveStop(building.id);
      setVisitedStops((prev) => {
        const next = new Set(prev);
        next.add(building.id);
        return next;
      });

      if (building.id === 'VESTORA_DOOR') {
        setStressLevel(26);
        if (soundEnabledRef.current) {
          const ctx = ensureAudio();
          playTone(ctx, 523.25, 0.16, 'sine', 0.04);
          setTimeout(() => playTone(ctx, 659.25, 0.2, 'sine', 0.045), 90);
        }
      } else {
        setStressLevel((prev) => Math.max(prev, building.visitedStress));
        if (soundEnabledRef.current) {
          const ctx = ensureAudio();
          playTone(ctx, 210, 0.18, 'triangle', 0.035);
        }
      }
    },
    [ensureAudio]
  );

  const enterVestoraOffice = useCallback(() => {
    setActiveStop('VESTORA_INSIDE');
    setIsMoviePlaying(false);
    setStressLevel(22);
    if (soundEnabledRef.current) {
      const ctx = ensureAudio();
      playTone(ctx, 523.25, 0.15, 'sine', 0.04);
      setTimeout(() => playTone(ctx, 659.25, 0.15, 'sine', 0.04), 100);
      setTimeout(() => playTone(ctx, 783.99, 0.25, 'sine', 0.05), 200);
    }
  }, [ensureAudio]);

  const handleSolveInsideOffice = useCallback(() => {
    setOfficeSolved(true);
    setStressLevel(8);
    if (soundEnabledRef.current) {
      const ctx = ensureAudio();
      playTone(ctx, 587.33, 0.14, 'sine', 0.04);
      setTimeout(() => playTone(ctx, 880, 0.28, 'sine', 0.05), 110);
    }
  }, [ensureAudio]);

  const handleResetStory = useCallback(() => {
    setIsMoviePlaying(false);
    setMode('GAME');
    playerXRef.current = 130;
    cameraXRef.current = 0;
    targetAutoXRef.current = null;
    facingRef.current = 1;
    setPlayerXState(130);
    setActiveStop('START');
    setVisitedStops(new Set());
    setStressLevel(52);
    setOfficeSolved(false);
    setNearbyBuilding(null);
  }, []);

  const walkToStop = useCallback(
    (building: StreetBuilding) => {
      setActiveStop((curr) => (curr === 'VESTORA_INSIDE' ? 'START' : curr));
      targetAutoXRef.current = building.x + building.width * 0.5;
    },
    []
  );

  // Movie mode choreography state machine
  useEffect(() => {
    if (mode !== 'MOVIE' || !isMoviePlaying) return;

    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(() => resolve(), Math.round(ms / movieSpeed));
      });

    const waitUntilNear = (targetX: number) =>
      new Promise<void>((resolve) => {
        targetAutoXRef.current = targetX;
        const check = () => {
          if (cancelled) return;
          if (Math.abs(playerXRef.current - targetX) < 12) {
            targetAutoXRef.current = null;
            resolve();
            return;
          }
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });

    const runMovie = async () => {
      // Reset to start if already inside or completed
      if (activeStopRef.current === 'VESTORA_INSIDE' || playerXRef.current > 2100) {
        playerXRef.current = 130;
        cameraXRef.current = 0;
        setVisitedStops(new Set());
        setStressLevel(52);
        setOfficeSolved(false);
        setActiveStop('START');
        await wait(700);
      }

      for (const b of BUILDINGS) {
        if (cancelled) return;
        await waitUntilNear(b.x + b.width * 0.5);
        if (cancelled) return;
        visitBuilding(b);
        await wait(b.id === 'VESTORA_DOOR' ? 2300 : 2800);
      }

      if (cancelled) return;
      enterVestoraOffice();
      await wait(1400);
      if (cancelled) return;
      handleSolveInsideOffice();
    };

    runMovie();

    return () => {
      cancelled = true;
      targetAutoXRef.current = null;
    };
  }, [mode, isMoviePlaying, movieSpeed, visitBuilding, enterVestoraOffice, handleSolveInsideOffice]);

  const startAnimatedMovie = () => {
    setMode('MOVIE');
    setActiveStop('START');
    playerXRef.current = 130;
    cameraXRef.current = 0;
    setVisitedStops(new Set());
    setStressLevel(52);
    setOfficeSolved(false);
    setIsMoviePlaying(true);
  };

  // Keyboard movement controls for playable mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (activeStopRef.current === 'VESTORA_INSIDE') return;

      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        targetAutoXRef.current = null;
        if (mode === 'MOVIE') setIsMoviePlaying(false);
        keysRef.current.right = true;
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        targetAutoXRef.current = null;
        if (mode === 'MOVIE') setIsMoviePlaying(false);
        keysRef.current.left = true;
      } else if (e.key === 'Enter' || e.key === ' ') {
        const px = playerXRef.current;
        const hit = BUILDINGS.find((b) => Math.abs(px - (b.x + b.width * 0.5)) < 110);
        if (hit) {
          e.preventDefault();
          if (hit.id === 'VESTORA_DOOR' && visitedRef.current.has('VESTORA_DOOR')) {
            enterVestoraOffice();
          } else {
            visitBuilding(hit);
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.right = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.left = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [mode, visitBuilding, enterVestoraOffice]);

  const isInsideOffice = activeStop === 'VESTORA_INSIDE';

  // 60FPS HTML5 Canvas street render & physics loop
  useEffect(() => {
    if (isInsideOffice) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTs = performance.now();

    const drawLoop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      // Resize canvas cleanly for crisp HiDPI rendering
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = canvas.clientWidth || 960;
      const cssH = canvas.clientHeight || 390;
      if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
      }

      // Movement update (unless inside Vestora consultation view)
      let vx = 0;
      if (activeStopRef.current !== 'VESTORA_INSIDE') {
        const manualSpeed = 270;
        const autoSpeed = mode === 'MOVIE' ? 225 * movieSpeed : 320;

        if (keysRef.current.right) vx = manualSpeed;
        else if (keysRef.current.left) vx = -manualSpeed;
        else if (targetAutoXRef.current !== null) {
          const diff = targetAutoXRef.current - playerXRef.current;
          if (Math.abs(diff) > 8) {
            vx = Math.sign(diff) * autoSpeed;
          } else {
            playerXRef.current = targetAutoXRef.current;
            targetAutoXRef.current = null;
          }
        }

        if (vx !== 0) {
          playerXRef.current = Math.max(
            INVESTOR_MIN_X,
            Math.min(INVESTOR_MAX_X, playerXRef.current + vx * dt)
          );
          facingRef.current = vx > 0 ? 1 : -1;
          walkPhaseRef.current += dt * 11;

          // Subtle footstep tick sound
          if (soundEnabledRef.current && now - lastStepSoundRef.current > 260) {
            lastStepSoundRef.current = now;
            stepSoundPhaseRef.current = (stepSoundPhaseRef.current + 1) % 2;
            playTone(audioCtxRef.current, stepSoundPhaseRef.current === 0 ? 135 : 115, 0.04, 'triangle', 0.012);
          }
        }
      }

      // Smooth camera follow
      const desiredCam = Math.max(0, Math.min(WORLD_WIDTH - cssW, playerXRef.current - cssW * 0.38));
      cameraXRef.current += (desiredCam - cameraXRef.current) * Math.min(1, dt * 6);

      // Update React proximity & X telemetry gently when changed
      const hitBuilding =
        BUILDINGS.find((b) => Math.abs(playerXRef.current - (b.x + b.width * 0.5)) < 110) ?? null;
      setNearbyBuilding((prev) => (prev?.id === hitBuilding?.id ? prev : hitBuilding));
      setPlayerXState((prev) => (Math.abs(prev - playerXRef.current) > 8 ? Math.round(playerXRef.current) : prev));

      // Auto-trigger stop card when walking manually past a building door for the first time
      if (mode === 'GAME' && hitBuilding && !visitedRef.current.has(hitBuilding.id) && vx !== 0) {
        if (Math.abs(playerXRef.current - (hitBuilding.x + hitBuilding.width * 0.5)) < 38) {
          visitBuilding(hitBuilding);
        }
      }

      // -----------------------------------------------------------------------
      // DRAW SCENE
      // -----------------------------------------------------------------------
      ctx.save();
      ctx.scale(dpr, dpr);

      const camX = cameraXRef.current;
      const groundY = cssH - 76;

      // 1. Evening Sky Gradient (Obsidian twilight matching Street Story artwork)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      skyGrad.addColorStop(0, '#050811');
      skyGrad.addColorStop(0.6, '#0a111f');
      skyGrad.addColorStop(1, '#131d31');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, cssW, cssH);

      // Crescent moon & stars
      ctx.fillStyle = 'rgba(226, 232, 240, 0.35)';
      for (let i = 0; i < 24; i++) {
        const sx = ((i * 197 + 40 - camX * 0.08) % (cssW + 60) + cssW + 60) % (cssW + 60) - 30;
        const sy = 22 + ((i * 53) % 95);
        ctx.fillRect(sx, sy, i % 3 === 0 ? 2 : 1.3, i % 3 === 0 ? 2 : 1.3);
      }

      // 2. Parallax Distant City Skyline (0.25x speed)
      ctx.fillStyle = '#090f1d';
      for (let i = 0; i < 18; i++) {
        const bx = i * 180 - camX * 0.25;
        const bh = 70 + ((i * 47) % 95);
        ctx.fillRect(bx, groundY - bh - 20, 145, bh + 20);
      }

      // 3. Sidewalk & Street Asphalt
      ctx.fillStyle = '#182132';
      ctx.fillRect(0, groundY - 12, cssW, 18); // sidewalk curb
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, groundY + 6, cssW, cssH - groundY);

      // Dashed road centerline
      ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
      for (let rx = -((camX * 1) % 72); rx < cssW; rx += 72) {
        ctx.fillRect(rx, groundY + 38, 36, 4);
      }

      // 4. World Space Layer
      ctx.save();
      ctx.translate(-camX, 0);

      // Streetlamps along sidewalk
      for (let lx = 170; lx < WORLD_WIDTH; lx += 340) {
        // Pole
        ctx.fillStyle = '#334155';
        ctx.fillRect(lx - 3, groundY - 135, 6, 123);
        ctx.fillRect(lx - 3, groundY - 135, 22, 4);
        // Lamp bulb + warm cone
        const isNearVestora = lx > 1900;
        const lampGlow = ctx.createRadialGradient(lx + 16, groundY - 128, 3, lx + 16, groundY - 90, 95);
        lampGlow.addColorStop(0, isNearVestora ? 'rgba(52, 211, 153, 0.26)' : 'rgba(251, 191, 36, 0.20)');
        lampGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = lampGlow;
        ctx.beginPath();
        ctx.arc(lx + 16, groundY - 90, 95, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isNearVestora ? '#34d399' : '#fcd34d';
        ctx.beginPath();
        ctx.arc(lx + 16, groundY - 129, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Buildings
      BUILDINGS.forEach((b) => {
        const bx = b.x;
        const by = groundY - 12 - b.height;
        const isVestora = b.id === 'VESTORA_DOOR';
        const isNearby = hitBuilding?.id === b.id;
        const isVisited = visitedRef.current.has(b.id);

        // Building Exterior Glow for Vestora Wealth
        if (isVestora) {
          const glow = ctx.createRadialGradient(
            bx + b.width / 2,
            by + b.height / 2,
            20,
            bx + b.width / 2,
            by + b.height / 2,
            230
          );
          glow.addColorStop(0, 'rgba(2, 195, 126, 0.26)');
          glow.addColorStop(0.55, 'rgba(2, 162, 109, 0.12)');
          glow.addColorStop(1, 'rgba(6, 9, 17, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(bx - 60, by - 60, b.width + 120, b.height + 80);
        }

        // Main building facade
        ctx.fillStyle = isVestora ? '#0a141d' : '#111827';
        ctx.strokeStyle = isVestora ? '#02c37e' : isNearby ? '#34d99b' : '#26334a';
        ctx.lineWidth = isVestora || isNearby ? 2 : 1.2;
        ctx.fillRect(bx, by, b.width, b.height);
        ctx.strokeRect(bx, by, b.width, b.height);

        // Architectural details per building
        if (b.id === 'SITES') {
          // Multi-screen noisy finance websites / forums wall
          const screens = [
            { dx: 20, label: 'BUY NOW!', col: '#34d399' },
            { dx: 102, label: 'CRASH?!', col: '#fb7185' },
            { dx: 184, label: 'TOP 10?', col: '#fbbf24' },
          ];
          screens.forEach((sc) => {
            ctx.fillStyle = '#090f1d';
            ctx.fillRect(bx + sc.dx, by + 74, 72, 54);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
            ctx.strokeRect(bx + sc.dx, by + 74, 72, 54);
            ctx.fillStyle = sc.col;
            ctx.font = 'bold 9px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(sc.label, bx + sc.dx + 36, by + 105);
          });
        } else if (b.id === 'ADVISOR') {
          // Flashy commission sales booth
          ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
          ctx.fillRect(bx + 20, by + 74, b.width - 40, 60);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
          ctx.strokeRect(bx + 20, by + 74, b.width - 40, 60);
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('HOT NFO · 1.8% COMMISSION', bx + b.width / 2, by + 109);
        } else if (b.id === 'WEALTH_MGR') {
          // Exclusive marble VIP desk with velvet barrier
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(bx - 8, by);
          ctx.lineTo(bx + b.width / 2, by - 28);
          ctx.lineTo(bx + b.width + 8, by);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#273449';
          for (let c = 0; c < 4; c++) {
            ctx.fillRect(bx + 22 + c * 74, by + 64, 14, b.height - 64);
          }
          ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
          ctx.fillRect(bx + 46, by + 84, b.width - 92, 42);
          ctx.fillStyle = '#cbd5e1';
          ctx.font = 'bold 9.5px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('1.5% AUM FEE · SILOED', bx + b.width / 2, by + 109);
        } else if (isVestora) {
          // Glass executive interior preview through wide windows
          const winGrad = ctx.createLinearGradient(bx, by + 75, bx, by + b.height);
          winGrad.addColorStop(0, 'rgba(79, 70, 229, 0.28)');
          winGrad.addColorStop(1, 'rgba(16, 185, 129, 0.20)');
          ctx.fillStyle = winGrad;
          ctx.fillRect(bx + 18, by + 76, b.width - 36, b.height - 86);
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
          ctx.strokeRect(bx + 18, by + 76, b.width - 36, b.height - 86);

          // Live chart silhouette inside Vestora glass window
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx + 34, by + 145);
          ctx.lineTo(bx + 62, by + 132);
          ctx.lineTo(bx + 88, by + 136);
          ctx.lineTo(bx + 118, by + 108);
          ctx.stroke();
        }

        // Entrance Door
        const doorW = isVestora ? 64 : 48;
        const doorH = 74;
        const doorX = bx + b.width / 2 - doorW / 2;
        const doorY = groundY - 12 - doorH;
        ctx.fillStyle = isVestora ? '#064e3b' : '#0b1220';
        ctx.fillRect(doorX, doorY, doorW, doorH);
        ctx.strokeStyle = isVestora ? '#34d399' : '#475569';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(doorX, doorY, doorW, doorH);

        // Signboard above building entrance
        const signW = b.width - 20;
        const signX = bx + 10;
        const signY = by + 14;
        ctx.fillStyle = isVestora ? '#080e1a' : '#090e1a';
        ctx.fillRect(signX, signY, signW, 44);
        ctx.strokeStyle = isVestora ? '#02c37e' : b.accentColor;
        ctx.lineWidth = isVestora ? 2 : 1.2;
        ctx.strokeRect(signX, signY, signW, 44);

        if (isVestora) {
          // Faceted white + emerald V crest on signboard
          const lx = signX + 14;
          const ly = signY + 9;
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.moveTo(lx + 1, ly + 4);
          ctx.lineTo(lx + 7, ly + 4);
          ctx.lineTo(lx + 12, ly + 22);
          ctx.lineTo(lx + 10, ly + 26);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#02c37e';
          ctx.beginPath();
          ctx.moveTo(lx + 10, ly + 26);
          ctx.lineTo(lx + 12, ly + 22);
          ctx.lineTo(lx + 24, ly + 1);
          ctx.lineTo(lx + 18, ly + 7);
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle = isVestora ? '#34d99b' : '#f8fafc';
        ctx.font = 'bold 12px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.signTop, bx + b.width / 2 + (isVestora ? 10 : 0), signY + 19);

        ctx.fillStyle = isVestora ? '#a7f3d0' : '#94a3b8';
        ctx.font = '600 9.5px JetBrains Mono, monospace';
        ctx.fillText(b.signSub, bx + b.width / 2 + (isVestora ? 10 : 0), signY + 35);

        // Interactive prompt over nearby door
        if (isNearby && mode === 'GAME') {
          const pulseY = Math.sin(now / 260) * 3;
          ctx.fillStyle = '#02c37e';
          ctx.fillRect(bx + b.width / 2 - 74, by - 36 + pulseY, 148, 24);
          ctx.fillStyle = '#04130d';
          ctx.font = 'bold 10.5px DM Sans, sans-serif';
          ctx.fillText(
            isVestora
              ? isVisited
                ? 'Press Enter · Step Inside'
                : 'Press Enter · Vestora Sign'
              : isVisited
              ? 'Visited · Keep Walking →'
              : 'Press Enter · Ask Counter',
            bx + b.width / 2,
            by - 20 + pulseY
          );
        }
      });

      // 5. Draw Investor Character ("You")
      const px = playerXRef.current;
      const py = groundY - 12;
      const isMoving = Math.abs(vx) > 2;
      const stride = isMoving ? Math.sin(walkPhaseRef.current) : 0;
      const bob = isMoving ? Math.abs(Math.cos(walkPhaseRef.current)) * 2.5 : 0;
      const currentStress = stressRef.current;
      const hunch = currentStress > 60 ? 5 : 0;

      ctx.save();
      ctx.translate(px, py - bob);
      ctx.scale(facingRef.current, 1);

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 1 + bob, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-4, -24);
      ctx.lineTo(-4 + stride * 10, -2);
      ctx.moveTo(4, -24);
      ctx.lineTo(4 - stride * 10, -2);
      ctx.stroke();

      // Torso (suit jacket)
      ctx.fillStyle = currentStress > 60 ? '#475569' : '#02c37e';
      ctx.beginPath();
      ctx.roundRect(-11 + hunch * 0.4, -54, 22, 32, 6);
      ctx.fill();

      // Bulging heavy briefcase / paper clutter until solved
      if (currentStress > 30) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(8, -28 + stride * 2, 16, 12);
        ctx.fillStyle = '#f8fafc';
        // Loose papers sticking out of briefcase
        ctx.fillRect(10, -32 + stride * 2, 5, 6);
        ctx.fillRect(16, -31 + stride * 2, 5, 5);
      }

      // Head
      ctx.fillStyle = '#f1c27d';
      ctx.beginPath();
      ctx.arc(hunch * 0.6, -65, 10.5, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(hunch * 0.6 - 1, -68, 10, Math.PI, Math.PI * 2);
      ctx.fill();

      // Floating stress / question indicator when confused
      if (currentStress >= 65) {
        const floatY = Math.sin(now / 220) * 3;
        ctx.scale(facingRef.current, 1); // keep text unflipped
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 13px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(currentStress > 85 ? '?!' : '?', 0, -86 + floatY);
      }

      ctx.restore();
      ctx.restore();
      ctx.restore();

      rafId = requestAnimationFrame(drawLoop);
    };

    rafId = requestAnimationFrame(drawLoop);
    return () => cancelAnimationFrame(rafId);
  }, [isInsideOffice, mode, movieSpeed, visitBuilding]);

  const currentDialogueBuilding = useMemo(
    () => BUILDINGS.find((b) => b.id === activeStop) ?? null,
    [activeStop]
  );

  const stressMeta = useMemo(() => {
    if (stressLevel >= 80) return { label: 'Exhausted', color: 'text-rose-400', bar: 'bg-rose-500' };
    if (stressLevel >= 55) return { label: 'Confused & Drained', color: 'text-amber-300', bar: 'bg-amber-400' };
    if (stressLevel >= 20) return { label: 'Relieved', color: 'text-emerald-300', bar: 'bg-emerald-400' };
    return { label: 'Clear & Unbiased', color: 'text-emerald-400', bar: 'bg-emerald-500' };
  }, [stressLevel]);

  const collectedPapers = useMemo(() => {
    return BUILDINGS.filter((b) => b.id !== 'VESTORA_DOOR' && visitedStops.has(b.id)).map(
      (b) => b.paperSlip
    );
  }, [visitedStops]);

  return (
    <div className="space-y-6">
      {/* Marketing Hero + Controls Header */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-emerald-400">Interactive Wealth Story</span>
              <span aria-hidden="true">·</span>
              <span>From biased advice exhaustion to complete, fair clarity on one portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
              Multiple Investments. Active Loans. Zero Fair Advice — Until Vestora Arrives.
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Play as an investor juggling <span className="text-slate-200 font-medium">{portfolioSnapshot.count} investments</span>, a matured <span className="text-slate-200 font-medium">{portfolioSnapshot.maturedAmount}</span> deposit, and an 8.55% home loan. Visit generic finance sites, commission advisors, and wealth managers—or watch the short movie—until <span className="text-emerald-400 font-semibold">Vestora Wealth</span> solves every piece fairly on one screen.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex p-1 bg-slate-950 border border-slate-800 rounded-lg gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsMoviePlaying(false);
                  setMode('GAME');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'GAME' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Interactive Game
              </button>
              <button
                type="button"
                onClick={startAnimatedMovie}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                  mode === 'MOVIE' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Watch Short Movie</span>
              </button>
            </div>

            <button
              type="button"
              onClick={toggleSound}
              className="p-2 text-xs text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors shrink-0"
              aria-label={soundEnabled ? 'Mute sound effects' : 'Enable subtle sound effects'}
              title={soundEnabled ? 'Sound FX On' : 'Sound FX Off'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            <button
              type="button"
              onClick={handleResetStory}
              className="px-3 py-2 text-xs font-medium text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart</span>
            </button>
          </div>
        </div>

        {/* Unobtrusive Top HUD Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-xs">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">Advice Exhaustion Meter</span>
              <span className={`font-semibold tabular-nums ${stressMeta.color}`}>
                {stressLevel}% · {stressMeta.label}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-950 rounded-sm overflow-hidden">
              <div
                style={{ width: `${stressLevel}%` }}
                className={`h-full transition-all duration-300 ${stressMeta.bar}`}
              />
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-center gap-4 font-mono">
            <div>
              <span className="text-slate-500 block text-2xs">Journey Progress</span>
              <span className="text-slate-200 font-semibold tabular-nums">
                {visitedStops.size} / 4 Stops · {Math.round((playerXState / 2175) * 100)}% Avenue
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-2xs">Half-Baked Advice</span>
              <span className={`font-semibold tabular-nums ${officeSolved ? 'text-emerald-400' : 'text-amber-300'}`}>
                {officeSolved ? '0 (Full & Fair Plan)' : `${collectedPapers.length} biased pitches`}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-start md:justify-end gap-2">
            {mode === 'MOVIE' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsMoviePlaying((p) => !p)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  {isMoviePlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isMoviePlaying ? 'Pause Film' : 'Resume Film'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMovieSpeed((s) => (s === 1 ? 1.5 : 1))}
                  className="px-2.5 py-1.5 text-xs font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded-lg hover:text-white whitespace-nowrap"
                >
                  {movieSpeed}x
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onOpenOverview}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>Enter Overview Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Main Stage: Either 2D Street Avenue Canvas OR Vestora Office Interior Climax */}
      {activeStop === 'VESTORA_INSIDE' ? (
        <section
          id="street-stage"
          aria-label="Inside Vestora Wealth Office"
          className="scroll-mt-20 bg-slate-900 border border-emerald-500/40 rounded-xl p-6 space-y-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="flex items-start gap-3.5">
              <VestoraLogo size={40} className="mt-0.5 hidden sm:block" />
              <div>
                <div className="text-2xs font-mono text-emerald-400 font-semibold">
                  INSIDE VESTORA WEALTH · UNBIASED ON-DEVICE PORTAL
                </div>
                <h2 className="text-xl font-bold text-white mt-1">
                  Full &amp; Fair Wealth Clarity Across Every Investment and Loan — On One Portal
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                  No biased commissions, no generic web noise, and no siloed wealth managers. Vestora evaluates all your holdings, taxes, and loans fairly against live open markets—strictly on your device.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveStop('VESTORA_DOOR')}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Step Back Outside</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: The Exhausting Puzzle Brought From the Street */}
            <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Why You Felt Exhausted</h3>
                <span className="text-2xs font-mono text-amber-300">Partial &amp; Biased Advice</span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="pb-3 border-b border-slate-800/80">
                  <div className="font-semibold text-slate-200">1. Conflicting Finance Sites &amp; Generic Tips</div>
                  <div className="text-slate-400 mt-0.5">
                    47 browser tabs couldn&apos;t see your {portfolioSnapshot.count} actual holdings or matured {portfolioSnapshot.maturedAmount} deposit together.
                  </div>
                </div>
                <div className="pb-3 border-b border-slate-800/80">
                  <div className="font-semibold text-slate-200">2. Commission-Driven Advisors</div>
                  <div className="text-slate-400 mt-0.5">
                    Pushed high-fee Regular NFOs while ignoring your 8.55% home loan interest drain and tax slabs.
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-slate-200">3. Siloed Wealth Managers</div>
                  <div className="text-slate-400 mt-0.5">
                    Charged 1.5% AUM fees while ignoring outside bank FDs, EPF/NPS, and active loans.
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Vestora Live Solution Engine */}
            <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">
                  Vestora Full &amp; Fair Rebalance Diagnosis
                </h3>
                <span className="text-2xs font-mono text-emerald-400">
                  AMFI · NPSNAV · GoI G-Sec · Loan Math Live
                </span>
              </div>

              {!officeSolved ? (
                <div className="py-6 text-center space-y-4">
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    Click below to let Vestora evaluate every investment, tax bracket, and active loan together with zero bias or commissions.
                  </p>
                  <button
                    type="button"
                    onClick={handleSolveInsideOffice}
                    className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors inline-flex items-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>Solve My Investments &amp; Loans Fairly</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono tabular-nums">
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-2xs text-slate-400 block">45% Home Loan Prepay</span>
                      <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                        8.55% Tax-Free Saved
                      </span>
                      <span className="text-2xs text-slate-500">Beats bank FD after tax</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-2xs text-slate-400 block">35% Direct Index + Arbitrage</span>
                      <span className="text-sm font-bold text-indigo-400 mt-0.5 block">
                        0% Agent Commission
                      </span>
                      <span className="text-2xs text-slate-500">12.5% LTCG tax efficiency</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-2xs text-slate-400 block">20% Live NPS Tier-I</span>
                      <span className="text-sm font-bold text-amber-300 mt-0.5 block">
                        Extra ₹50K 80CCD(1B)
                      </span>
                      <span className="text-2xs text-slate-500">Direct PFRDA NAV tracked</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Problem solved in seconds. Ready to run this on your actual {holdings.length} holdings?
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={onOpenValidateModal}
                        className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg whitespace-nowrap"
                      >
                        Upload Your Excel / CSV
                      </button>
                      <button
                        type="button"
                        onClick={onEnterLiveRebalance}
                        className="px-3 py-2 text-xs font-medium text-emerald-300 bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 rounded-lg whitespace-nowrap"
                      >
                        Open Rebalance
                      </button>
                      <button
                        type="button"
                        onClick={onOpenOverview}
                        className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <span>Enter Vestora Overview</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section id="street-stage" aria-label="2D Street Simulation Stage" className="scroll-mt-20 space-y-4">
          {/* Canvas Viewport */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
            <canvas
              ref={canvasRef}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickWorldX = e.clientX - rect.left + cameraXRef.current;
                setMode('GAME');
                setIsMoviePlaying(false);
                targetAutoXRef.current = Math.max(
                  INVESTOR_MIN_X,
                  Math.min(INVESTOR_MAX_X, clickWorldX)
                );
              }}
              className="w-full h-[360px] sm:h-[390px] block cursor-pointer"
              aria-label="Interactive street animation showing Finance Sites, Commission Advisor, Wealth Manager, and Vestora Wealth"
            />

            {/* Controls & Quick Jump Street Bar */}
            <div className="bg-slate-900 border-t border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onMouseDown={() => {
                    targetAutoXRef.current = null;
                    setIsMoviePlaying(false);
                    setMode('GAME');
                    keysRef.current.left = true;
                  }}
                  onMouseUp={() => {
                    keysRef.current.left = false;
                  }}
                  onMouseLeave={() => {
                    keysRef.current.left = false;
                  }}
                  onTouchStart={() => {
                    targetAutoXRef.current = null;
                    setIsMoviePlaying(false);
                    setMode('GAME');
                    keysRef.current.left = true;
                  }}
                  onTouchEnd={() => {
                    keysRef.current.left = false;
                  }}
                  className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-200 inline-flex items-center gap-1 select-none"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Walk Left</span>
                </button>
                <button
                  type="button"
                  onMouseDown={() => {
                    targetAutoXRef.current = null;
                    setIsMoviePlaying(false);
                    setMode('GAME');
                    keysRef.current.right = true;
                  }}
                  onMouseUp={() => {
                    keysRef.current.right = false;
                  }}
                  onMouseLeave={() => {
                    keysRef.current.right = false;
                  }}
                  onTouchStart={() => {
                    targetAutoXRef.current = null;
                    setIsMoviePlaying(false);
                    setMode('GAME');
                    keysRef.current.right = true;
                  }}
                  onTouchEnd={() => {
                    keysRef.current.right = false;
                  }}
                  className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-200 inline-flex items-center gap-1 select-none"
                >
                  <span>Walk Right</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <span className="hidden xl:inline text-2xs text-slate-500 ml-1">
                  Use Arrow Keys / A &amp; D, or click anywhere on the street
                </span>
              </div>

              {/* Direct Street Stop Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {BUILDINGS.map((b) => {
                  const visited = visitedStops.has(b.id);
                  const isVestora = b.id === 'VESTORA_DOOR';
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setMode('GAME');
                        setIsMoviePlaying(false);
                        walkToStop(b);
                      }}
                      className={`px-2.5 py-1.5 text-2xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                        isVestora
                          ? 'bg-emerald-950/50 border-emerald-500/45 text-emerald-300 hover:bg-emerald-900/50'
                          : visited
                          ? 'bg-slate-800 border-slate-700 text-slate-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {b.signTop}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Story Dialogue & Door Interaction Panel */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {currentDialogueBuilding ? (
              <>
                <div className="space-y-2 max-w-3xl">
                  <div className="flex items-center gap-2 text-2xs font-mono">
                    <span
                      className={
                        currentDialogueBuilding.id === 'VESTORA_DOOR'
                          ? 'text-emerald-400 font-semibold'
                          : 'text-amber-300 font-semibold'
                      }
                    >
                      {currentDialogueBuilding.badgeText}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-400">{currentDialogueBuilding.speaker}</span>
                  </div>
                  <p className="text-sm text-white leading-relaxed font-medium">
                    {currentDialogueBuilding.dialogue}
                  </p>
                  <p className="text-xs text-slate-400 italic">
                    You think: {currentDialogueBuilding.investorThought}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {currentDialogueBuilding.id === 'VESTORA_DOOR' ? (
                    <button
                      type="button"
                      onClick={enterVestoraOffice}
                      className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <DoorOpen className="w-4 h-4" />
                      <span>Step Inside Vestora Wealth</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = BUILDINGS.findIndex((x) => x.id === currentDialogueBuilding.id);
                        const nextB = BUILDINGS[idx + 1];
                        if (nextB) {
                          setMode('GAME');
                          setIsMoviePlaying(false);
                          walkToStop(nextB);
                        }
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <span>Walk to Next Office</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="text-2xs font-mono text-emerald-400 font-semibold">
                    {nearbyBuilding ? `OUTSIDE ${nearbyBuilding.signTop}` : 'ON THE AVENUE'}
                  </div>
                  <p className="text-sm text-slate-200 font-medium">
                    {nearbyBuilding
                      ? `You are standing outside ${nearbyBuilding.name}. Step up to see what advice they give, or keep walking down the street.`
                      : 'You’re juggling multiple investments, bank deposits, and an 8.55% home loan with no clear rebalance plan. Walk right to consult Finance Sites, Commission Advisors, and Wealth Managers — until you reach Vestora Wealth.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {nearbyBuilding ? (
                    <button
                      type="button"
                      onClick={() =>
                        nearbyBuilding.id === 'VESTORA_DOOR'
                          ? enterVestoraOffice()
                          : visitBuilding(nearbyBuilding)
                      }
                      className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <DoorOpen className="w-3.5 h-3.5" />
                      <span>
                        {nearbyBuilding.id === 'VESTORA_DOOR'
                          ? 'Enter Vestora Portal'
                          : `Consult ${nearbyBuilding.signTop}`}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => walkToStop(BUILDINGS[0])}
                      className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <span>Start Journey · Finance Sites</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Marketing Proof Section: Biased & Siloed Advice vs Vestora Wealth */}
      <section
        id="why-vestora"
        aria-label="Why Vestora Wealth"
        className="scroll-mt-20 bg-slate-900/85 border border-slate-800 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Why Exhausted Investors Leave Conflicting Advice Behind for Vestora
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              One private, commission-free portal connecting your real investments, taxes, and active loans with live open markets.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenOverview}
              className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-lg whitespace-nowrap"
            >
              Explore Full Portfolio Dashboard
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 text-xs">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>Finance Sites &amp; Forums</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Contradictory articles and generic checklists that never account for your actual holdings, tax slabs, or loans.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>Commission Advisors</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Push high-commission Regular plans and NFOs while ignoring 8.55% home loan interest savings and tax drag.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Landmark className="w-4 h-4 text-slate-400" />
              <span>Wealth Managers</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Charge steep AUM fees, ignore external bank FDs, EPF, or loans, and require storing sensitive records on their servers.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Vestora Wealth Portal</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Full, fair rebalancing across Direct MFs, NPS, GoI G-Secs, Gold &amp; Home Loans — 100% private on your device.
            </p>
          </div>
        </div>
      </section>

      {/* Search-Indexable FAQ Section (Synced with FAQPage JSON-LD) */}
      <section
        id="faq"
        aria-label="Frequently Asked Questions"
        className="bg-slate-900/75 border border-slate-800 rounded-xl p-6 space-y-4"
      >
        <div className="border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white">
            Frequently Asked Questions about Vestora Wealth
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Straight answers on unbiased rebalancing, home loan vs FD math, and on-device privacy.
          </p>
        </div>
        <div className="divide-y divide-slate-800/80 text-xs">
          {[
            {
              q: 'Should I prepay my home loan or reinvest a matured FD?',
              a: 'Prepaying an 8.55% home loan delivers a guaranteed, tax-free 8.55% effective return—often outperforming a 6.5% FD that yields roughly 4.55% after 30% income tax. Vestora Wealth compares your exact loan interest rate, tax bracket, and live Direct Mutual Fund, NPS, and RBI G-Sec yields side by side so you can split capital fairly.',
            },
            {
              q: 'How does Vestora Wealth keep my financial data private?',
              a: 'Vestora Wealth runs 100% on your device inside browser localStorage with zero account registration, zero cloud database, and zero external AI data sharing. You can import or export Excel, CSV, JSON, and PDF files directly on your machine.',
            },
            {
              q: 'Does Vestora Wealth charge commissions or push regular mutual fund plans?',
              a: 'No. Vestora Wealth is 0% commission and completely free to use. It highlights zero-commission Direct-Growth mutual funds, NPS Tier-I schemes, sovereign RBI G-Secs, and debt prepayment math with no sales bias or AUM fees.',
            },
            {
              q: 'Which investments and liabilities can I track in Vestora Wealth?',
              a: 'You can track and rebalance Bank Savings, Fixed Deposits (FD/RD), Direct & Regular Mutual Funds, Demat Equities, Sovereign Gold Bonds (SGB) & 24K Gold, RBI G-Secs & Corporate Bonds, EPF, PPF, NPS Tier-I, US Treasuries, and active Home or Personal Loans across INR, USD, EUR, GBP, SGD, and AED.',
            },
            {
              q: 'Can I import my existing portfolio or edit entries quickly?',
              a: 'Yes. You can upload Excel (.xlsx), CSV, or CAMS/KFintech statements, edit any holding inline, or use the built-in local portfolio chatbox to add, update, simulate, import, or export entries without sending data to any external server.',
            },
          ].map((item) => (
            <details key={item.q} className="group py-3">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-slate-200 hover:text-emerald-300 transition-colors">
                <span>{item.q}</span>
                <span className="text-slate-500 group-open:rotate-45 transition-transform text-base leading-none">+</span>
              </summary>
              <p className="mt-2 text-slate-400 leading-relaxed pr-6">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
};
