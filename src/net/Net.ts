/**
 * Online party play over WebRTC (Trystero). Peers find each other through public relay networks using a party code;
 * race data then flows directly browser to browser. No server, account or key is needed.
 */
import { joinRoom, selfId } from 'trystero';
import type { RemotePose, WeatherPreset } from '../core/types';

export type LobbySettings = {
  circuitId: string;
  laps: number;
  weather: WeatherPreset;
  eventLevel: number;
}

export type StartPlan = {
  seed: number;
  settings: LobbySettings;
  /** Grid order: the host starts on pole, then guests in join order. */
  players: { peerId: string; driverId: string }[];
}

type Hello = {
  driverId: string;
  host: boolean;
}

export const MAX_PLAYERS = 4;
const APP_ID = 'f1-simulator-shashank';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const STATE_INTERVAL_MS = 1000 / 15;

export const makeCode = (): string => {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
};

export const normaliseCode = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

interface RemoteEntry {
  pose: RemotePose;
  at: number;
}

export class Net {
  readonly selfId = selfId;
  readonly code: string;
  readonly isHost: boolean;
  driverId: string;
  settings: LobbySettings;
  /** Remote players in join order. */
  readonly players = new Map<string, { driverId: string; host: boolean }>();
  readonly remote = new Map<string, RemoteEntry>();

  onChange: (() => void) | null = null;
  onStart: ((plan: StartPlan) => void) | null = null;
  onGo: (() => void) | null = null;
  onClosed: ((reason: string) => void) | null = null;
  status = 'Connecting…';

  private room: ReturnType<typeof joinRoom> | null;
  private readonly sendHelloA;
  private readonly sendSettingsA;
  private readonly sendStartA;
  private readonly sendLoadedA;
  private readonly sendGoA;
  private readonly sendStateA;
  private plan: StartPlan | null = null;
  private readonly loaded = new Set<string>();
  private selfLoaded = false;
  private lastSent = 0;

  constructor(code: string, isHost: boolean, driverId: string, settings: LobbySettings) {
    this.code = code;
    this.isHost = isHost;
    this.driverId = driverId;
    this.settings = settings;
    const room = joinRoom(
      { appId: APP_ID },
      `f1sim-${code}`,
      {
        onJoinError: (e) => {
          this.status = `Could not join: ${e.error}`;
          this.onChange?.();
        },
      },
    );
    this.room = room;

    const hello = room.makeAction<Hello>('hello');
    const settingsA = room.makeAction<LobbySettings>('settings');
    const start = room.makeAction<StartPlan>('start');
    const loaded = room.makeAction<{ ok: boolean }>('loaded');
    const go = room.makeAction<{ ok: boolean }>('go');
    const state = room.makeAction<RemotePose>('state');
    this.sendHelloA = hello;
    this.sendSettingsA = settingsA;
    this.sendStartA = start;
    this.sendLoadedA = loaded;
    this.sendGoA = go;
    this.sendStateA = state;

    room.onPeerJoin = (id) => {
      this.status = isHost ? 'Player joining…' : 'Connected';
      void hello.send({ driverId: this.driverId, host: this.isHost }, { target: id });
      if (this.isHost) void settingsA.send(this.settings, { target: id });
      this.onChange?.();
    };
    room.onPeerLeave = (id) => {
      const p = this.players.get(id);
      this.players.delete(id);
      this.remote.delete(id);
      if (p?.host) this.onClosed?.('The host left the party.');
      this.onChange?.();
    };
    hello.onMessage = (h, { peerId }) => {
      this.players.set(peerId, { driverId: h.driverId, host: h.host });
      this.status = this.isHost ? 'Waiting for players' : 'Connected to the party';
      this.onChange?.();
    };
    settingsA.onMessage = (s) => {
      if (this.isHost) return;
      this.settings = s;
      this.onChange?.();
    };
    start.onMessage = (plan) => {
      if (this.isHost) return;
      this.plan = plan;
      this.onStart?.(plan);
    };
    loaded.onMessage = (_d, { peerId }) => {
      this.loaded.add(peerId);
      this.maybeGo();
    };
    go.onMessage = () => this.onGo?.();
    state.onMessage = (pose, { peerId }) => {
      this.remote.set(peerId, { pose, at: performance.now() });
    };
  }

  setDriver(driverId: string): void {
    this.driverId = driverId;
    void this.sendHelloA.send({ driverId, host: this.isHost });
  }

  setSettings(s: LobbySettings): void {
    this.settings = s;
    if (this.isHost) void this.sendSettingsA.send(s);
  }

  /** Host: lock the roster and start everyone. */
  start(): StartPlan | null {
    if (!this.isHost || this.players.size < 1) return null;
    const guests = [...this.players.entries()].slice(0, MAX_PLAYERS - 1);
    const plan: StartPlan = {
      seed: (crypto.getRandomValues(new Uint32Array(1))[0] >>> 1) | 1,
      settings: this.settings,
      players: [{ peerId: this.selfId, driverId: this.driverId }, ...guests.map(([peerId, p]) => ({ peerId, driverId: p.driverId }))],
    };
    this.plan = plan;
    this.loaded.clear();
    this.selfLoaded = false;
    void this.sendStartA.send(plan);
    this.onStart?.(plan);
    return plan;
  }

  /** This client is on the grid and ready. The host releases everyone once all players are ready. */
  markLoaded(): void {
    if (this.selfLoaded) return;
    this.selfLoaded = true;
    if (this.isHost) this.maybeGo();
    else void this.sendLoadedA.send({ ok: true });
  }

  private maybeGo(): void {
    if (!this.isHost || !this.plan || !this.selfLoaded) return;
    for (const p of this.plan.players) {
      if (p.peerId !== this.selfId && !this.loaded.has(p.peerId)) return;
    }
    void this.sendGoA.send({ ok: true });
    this.onGo?.();
  }

  /** Send the local car's pose about 15 times a second. */
  sendPose(pose: RemotePose, now: number): void {
    if (now - this.lastSent < STATE_INTERVAL_MS) return;
    this.lastSent = now;
    void this.sendStateA.send(pose);
  }

  leave(): void {
    const r = this.room;
    this.room = null;
    this.onChange = this.onStart = this.onGo = this.onClosed = null;
    if (r) void r.leave();
  }
}
