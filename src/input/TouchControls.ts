/**
 * On-screen driving controls for phones and tablets (also on desktop with ?touch=1).
 * Icon-only round and pedal buttons floating over the picture, laid out for two thumbs in landscape.
 * InputSystem reads the held state each frame and handles the one-shot callbacks.
 */
export interface TouchCallbacks {
  onErsCycle(): void;
  onPitLimiter(): void;
  onPitRequest(): void;
  onPause(): void;
  onAuto(auto: boolean): void;
}

export interface TouchPrefs {
  /** Button size multiplier 0.7 .. 1.5. */
  scale: number;
  /** Button opacity 0.3 .. 1. */
  opacity: number;
  /** Swap the steering and pedal sides (for left-handed play). */
  swap: boolean;
}

const PREFS_KEY = 'f1sim.touch.prefs';

const ICON = {
  left: '<svg viewBox="0 0 24 24"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gas: '<svg viewBox="0 0 24 36"><path d="M7 2h10l4 32H3z" fill="currentColor" opacity=".9"/><path d="M8 10h8M7 16h10M6.5 22h11M6 28h12" stroke="#0b0c0f" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/></svg>',
  brake: '<svg viewBox="0 0 36 24"><rect x="2" y="3" width="32" height="18" rx="4" fill="currentColor" opacity=".9"/><path d="M10 7v10M16 7v10M22 7v10M28 7v10" stroke="#0b0c0f" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/></svg>',
  boost: '<svg viewBox="0 0 24 24"><path d="M13.5 2 5 13.5h6L9.5 22 19 10h-6z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
};

const CSS = `
.tc{position:fixed;inset:0;z-index:30;pointer-events:none;display:none;font-family:"Inter","Segoe UI",Roboto,Arial,sans-serif;
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;
  --u:calc(min(16vmin,110px)*var(--tcs,1));--o:var(--tco,.7);color:#fff}
.tc.on{display:block}
.tc button{pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent;appearance:none;position:absolute;display:flex;align-items:center;justify-content:center;
  padding:0;color:#fff;opacity:var(--o);background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.5);filter:drop-shadow(0 2px 6px rgba(0,0,0,.5));
  transition:background .06s,color .06s,transform .06s}
.tc button svg{width:56%;height:56%;pointer-events:none}
.tc button.down{background:rgba(255,255,255,.88);color:#0b0c0f;border-color:#fff;transform:scale(.94)}
.tc .round{width:var(--u);height:var(--u);border-radius:50%}
.tc .steerL,.tc .steerR{bottom:calc(env(safe-area-inset-bottom) + 3.5vmin);width:calc(var(--u)*1.15);height:calc(var(--u)*1.15);border-radius:50%}
.tc .steerL{left:calc(env(safe-area-inset-left) + 3.5vmin)}
.tc .steerR{left:calc(env(safe-area-inset-left) + 3.5vmin + var(--u)*1.35)}
.tc .gas{right:calc(env(safe-area-inset-right) + 3.5vmin);bottom:calc(env(safe-area-inset-bottom) + 3.5vmin);width:calc(var(--u)*1.0);height:calc(var(--u)*1.7);border-radius:calc(var(--u)*.3);background:rgba(37,198,90,.22);border-color:rgba(37,198,90,.8)}
.tc .brake{right:calc(env(safe-area-inset-right) + 3.5vmin + var(--u)*1.2);bottom:calc(env(safe-area-inset-bottom) + 3.5vmin);width:calc(var(--u)*1.25);height:calc(var(--u)*1.0);border-radius:calc(var(--u)*.3);background:rgba(225,6,0,.22);border-color:rgba(255,75,75,.85)}
.tc .gas.down,.tc .brake.down{color:#0b0c0f}
.tc .gas svg{height:62%;width:auto}
.tc .brake svg{width:62%;height:auto}
.tc .boost{right:calc(env(safe-area-inset-right) + 3.5vmin + var(--u)*.05);bottom:calc(env(safe-area-inset-bottom) + 3.5vmin + var(--u)*1.85);width:calc(var(--u)*1.1);height:calc(var(--u)*1.1);border-radius:50%;background:rgba(111,168,255,.18);border-color:rgba(111,168,255,.9)}
.tc .boost.down{background:#6fa8ff;border-color:#fff}
.tc .ring{position:absolute;right:calc(env(safe-area-inset-right) + 3.5vmin + var(--u)*.05 - 5px);bottom:calc(env(safe-area-inset-bottom) + 3.5vmin + var(--u)*1.85 - 5px);width:calc(var(--u)*1.1 + 10px);height:calc(var(--u)*1.1 + 10px);pointer-events:none;opacity:var(--o);transform:rotate(-90deg)}
.tc .ring circle{fill:none;stroke-width:3.5}
.tc .ring .bg{stroke:rgba(255,255,255,.18)}
.tc .ring .fg{stroke:#6fa8ff;stroke-linecap:round;transition:stroke-dashoffset .2s}
.tc .drs{right:calc(env(safe-area-inset-right) + 3.5vmin + var(--u)*1.35);bottom:calc(env(safe-area-inset-bottom) + 3.5vmin + var(--u)*1.2);width:calc(var(--u)*.62);height:calc(var(--u)*.62);border-radius:50%;font:800 clamp(9px,2.2vmin,14px)/1 inherit;letter-spacing:.06em}
.tc .mode{right:calc(env(safe-area-inset-right) + 3.5vmin + var(--u)*1.35);bottom:calc(env(safe-area-inset-bottom) + 3.5vmin + var(--u)*1.95);width:calc(var(--u)*.62);height:calc(var(--u)*.62);border-radius:50%;font:800 clamp(8px,2vmin,13px)/1 inherit;letter-spacing:.04em}
.tc .pause{top:calc(env(safe-area-inset-top) + 2.5vmin);right:calc(env(safe-area-inset-right) + 2.5vmin);width:calc(var(--u)*.52);height:calc(var(--u)*.52);border-radius:50%}
.tc .pit{top:calc(env(safe-area-inset-top) + 2.5vmin);right:calc(env(safe-area-inset-right) + 2.5vmin + var(--u)*.7);width:calc(var(--u)*.52);height:calc(var(--u)*.52);border-radius:50%;font:800 clamp(8px,2vmin,12px)/1 inherit}
.tc .auto{top:calc(env(safe-area-inset-top) + 2.5vmin);right:calc(env(safe-area-inset-right) + 2.5vmin + var(--u)*1.45);height:calc(var(--u)*.46);padding:0 calc(var(--u)*.3);border-radius:999px;font:800 clamp(8px,2vmin,12px)/1 inherit;letter-spacing:.14em}
.tc .auto.manual{border-color:#ffb14a;color:#ffb14a}
.tc.swap .steerL{left:auto;right:calc(env(safe-area-inset-right) + 3.5vmin + var(--u)*1.35)}
.tc.swap .steerR{left:auto;right:calc(env(safe-area-inset-right) + 3.5vmin)}
.tc.swap .gas{right:auto;left:calc(env(safe-area-inset-left) + 3.5vmin)}
.tc.swap .brake{right:auto;left:calc(env(safe-area-inset-left) + 3.5vmin + var(--u)*1.2)}
.tc.swap .boost{right:auto;left:calc(env(safe-area-inset-left) + 3.5vmin + var(--u)*.05)}
.tc.swap .ring{right:auto;left:calc(env(safe-area-inset-left) + 3.5vmin + var(--u)*.05 - 5px)}
.tc.swap .drs,.tc.swap .mode{right:auto;left:calc(env(safe-area-inset-left) + 3.5vmin + var(--u)*1.35)}
`;

const RING_LEN = 2 * Math.PI * 21;

export class TouchControls {
  left = false;
  right = false;
  gas = false;
  brake = false;
  boost = false;
  drs = false;

  private readonly root: HTMLElement;
  private readonly modeBtn: HTMLButtonElement;
  private readonly autoBtn: HTMLButtonElement;
  private readonly ringFg: SVGCircleElement;
  private readonly enabled: boolean;
  private auto = true;
  private driving = false;
  private prefs: TouchPrefs = { scale: 1, opacity: 0.7, swap: false };

  constructor(private readonly cb: TouchCallbacks) {
    let force = false;
    try {
      force = new URLSearchParams(location.search).get('touch') === '1' || localStorage.getItem('f1sim.touch') === '1';
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) this.prefs = { ...this.prefs, ...JSON.parse(raw) };
    } catch {
      /* storage unavailable */
    }
    this.enabled = force || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || 'ontouchstart' in window;
    if (this.enabled) document.documentElement.classList.add('touch');

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'tc';
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());

    const hold = (html: string, cls: string, set: (v: boolean) => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.innerHTML = html;
      const down = (e: Event) => {
        e.preventDefault();
        b.classList.add('down');
        set(true);
      };
      const up = (e: Event) => {
        e.preventDefault();
        b.classList.remove('down');
        set(false);
      };
      b.addEventListener('pointerdown', (e) => {
        b.setPointerCapture(e.pointerId);
        down(e);
      });
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      return b;
    };
    const tap = (html: string, cls: string, fn: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.innerHTML = html;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        fn();
      });
      return b;
    };

    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('class', 'ring');
    ring.setAttribute('viewBox', '0 0 50 50');
    ring.innerHTML = `<circle class="bg" cx="25" cy="25" r="21"/><circle class="fg" cx="25" cy="25" r="21" stroke-dasharray="${RING_LEN}" stroke-dashoffset="0"/>`;
    this.ringFg = ring.querySelector('.fg') as SVGCircleElement;

    this.modeBtn = tap('BAL', 'mode round', () => cb.onErsCycle());
    this.autoBtn = tap('AUTO', 'auto', () => this.setAuto(!this.auto));

    this.root.append(
      hold(ICON.left, 'steerL', (v) => (this.left = v)),
      hold(ICON.right, 'steerR', (v) => (this.right = v)),
      hold(ICON.brake, 'brake', (v) => (this.brake = v)),
      hold(ICON.gas, 'gas', (v) => (this.gas = v)),
      ring,
      hold(ICON.boost, 'boost', (v) => (this.boost = v)),
      hold('DRS', 'drs', (v) => (this.drs = v)),
      this.modeBtn,
      tap(ICON.pause, 'pause', () => cb.onPause()),
      tap('PIT', 'pit', () => cb.onPitRequest()),
      this.autoBtn,
    );
    document.body.appendChild(this.root);
    this.applyPrefs();
  }

  /** Show the pad only while the player can drive, and only on touch devices (or ?touch=1). */
  setDriving(driving: boolean): void {
    this.driving = driving;
    this.root.classList.toggle('on', driving && this.enabled);
    if (!driving) this.left = this.right = this.gas = this.brake = this.boost = this.drs = false;
  }

  isActive(): boolean {
    return this.enabled && this.driving;
  }

  getPrefs(): TouchPrefs {
    return { ...this.prefs };
  }

  setPrefs(p: Partial<TouchPrefs>): void {
    this.prefs = { ...this.prefs, ...p };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      /* storage unavailable */
    }
    this.applyPrefs();
  }

  private applyPrefs(): void {
    this.root.style.setProperty('--tcs', String(this.prefs.scale));
    this.root.style.setProperty('--tco', String(this.prefs.opacity));
    this.root.classList.toggle('swap', this.prefs.swap);
  }

  setErsLabel(mode: string): void {
    this.modeBtn.textContent = mode === 'harvest' ? 'HRV' : mode === 'overtake' ? 'MAX' : 'BAL';
  }

  /** Boost charge 0..1 shown as the ring around the boost button. */
  setBoostLevel(v: number): void {
    const f = Math.max(0, Math.min(1, v));
    this.ringFg.setAttribute('stroke-dashoffset', String(RING_LEN * (1 - f)));
  }

  setLimiter(_on: boolean): void {
    /* the pit limiter is automatic with the pit assist */
  }

  private setAuto(auto: boolean): void {
    this.auto = auto;
    this.autoBtn.textContent = auto ? 'AUTO' : 'MANUAL';
    this.autoBtn.className = `auto${auto ? '' : ' manual'}`;
    this.cb.onAuto(auto);
  }

  dispose(): void {
    this.root.remove();
  }
}
