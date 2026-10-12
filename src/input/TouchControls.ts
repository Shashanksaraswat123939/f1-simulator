/**
 * On-screen driving controls for phones and tablets (also enabled on desktop with ?touch=1).
 * Pure DOM; InputSystem reads the held state each frame and handles the one-shot callbacks.
 */
export interface TouchCallbacks {
  onErsCycle(): void;
  onPitLimiter(): void;
  onPitRequest(): void;
  onPause(): void;
  onAuto(auto: boolean): void;
}

const CSS = `
.tc{position:fixed;inset:0;z-index:30;pointer-events:none;display:none;font-family:"Inter","Segoe UI",Roboto,Arial,sans-serif;
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;--u:min(13vmin,92px)}
.tc.on{display:block}
.tc button{pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent;appearance:none;border:1px solid rgba(255,255,255,.28);
  background:rgba(15,16,20,.55);color:#fff;font:700 clamp(10px,2.4vmin,15px)/1.1 inherit;letter-spacing:.08em;border-radius:6px;
  display:flex;align-items:center;justify-content:center;text-align:center;padding:0}
.tc button.down{background:rgba(255,255,255,.88);color:#0b0c0f;border-color:#fff}
.tc .steer{position:absolute;bottom:calc(env(safe-area-inset-bottom) + 3vmin);left:calc(env(safe-area-inset-left) + 3vmin);display:flex;gap:2vmin}
.tc .steer button{width:calc(var(--u)*1.35);height:calc(var(--u)*1.35);font-size:clamp(22px,6vmin,44px)}
.tc .pedals{position:absolute;bottom:calc(env(safe-area-inset-bottom) + 3vmin);right:calc(env(safe-area-inset-right) + 3vmin);display:flex;gap:2vmin;align-items:flex-end}
.tc .pedals .brake{width:calc(var(--u)*1.2);height:calc(var(--u)*1.5)}
.tc .pedals .gas{width:calc(var(--u)*1.2);height:calc(var(--u)*2.2);background:rgba(37,198,90,.3)}
.tc .pedals .brake{background:rgba(225,6,0,.3)}
.tc .pedals button.down{color:#0b0c0f}
.tc .side{position:absolute;right:calc(env(safe-area-inset-right) + 3vmin);bottom:calc(env(safe-area-inset-bottom) + 3vmin + var(--u)*2.4);display:flex;flex-direction:column;gap:1.6vmin;align-items:flex-end}
.tc .side button{width:calc(var(--u)*1.9);height:calc(var(--u)*.7)}
.tc .top{position:absolute;top:calc(env(safe-area-inset-top) + 1.5vmin);left:50%;transform:translateX(-50%);display:flex;gap:1.6vmin}
.tc .top button{height:calc(var(--u)*.55);padding:0 2vmin}
.tc .mode.auto{border-color:#25c65a}
.tc .mode.manual{border-color:#ffb14a}
`;

export class TouchControls {
  left = false;
  right = false;
  gas = false;
  brake = false;
  boost = false;
  drs = false;

  private readonly root: HTMLElement;
  private readonly ersBtn: HTMLButtonElement;
  private readonly modeBtn: HTMLButtonElement;
  private readonly limBtn: HTMLButtonElement;
  private readonly enabled: boolean;
  private auto = true;
  private driving = false;

  constructor(private readonly cb: TouchCallbacks) {
    let force = false;
    try {
      force = new URLSearchParams(location.search).get('touch') === '1' || localStorage.getItem('f1sim.touch') === '1';
    } catch {
      /* storage unavailable */
    }
    this.enabled = force || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || 'ontouchstart' in window;

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'tc';
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());

    const hold = (label: string, set: (v: boolean) => void, cls = ''): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.textContent = label;
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
    const tap = (label: string, fn: () => void, cls = ''): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.textContent = label;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        fn();
      });
      return b;
    };

    const steer = document.createElement('div');
    steer.className = 'steer';
    steer.append(
      hold('◀', (v) => (this.left = v)),
      hold('▶', (v) => (this.right = v)),
    );

    const pedals = document.createElement('div');
    pedals.className = 'pedals';
    pedals.append(
      hold('BRAKE', (v) => (this.brake = v), 'brake'),
      hold('GAS', (v) => (this.gas = v), 'gas'),
    );

    this.ersBtn = tap('BATTERY · BAL', () => cb.onErsCycle());
    this.limBtn = tap('PIT LIMITER', () => cb.onPitLimiter());
    const side = document.createElement('div');
    side.className = 'side';
    side.append(hold('BOOST', (v) => (this.boost = v)), hold('DRS', (v) => (this.drs = v)), this.ersBtn, this.limBtn);

    this.modeBtn = tap('AUTO', () => this.setAuto(!this.auto), 'mode auto');
    const top = document.createElement('div');
    top.className = 'top';
    top.append(this.modeBtn, tap('PIT', () => cb.onPitRequest()), tap('PAUSE', () => cb.onPause()));

    this.root.append(steer, pedals, side, top);
    document.body.appendChild(this.root);
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

  setErsLabel(mode: string): void {
    const short = mode === 'harvest' ? 'HARV' : mode === 'overtake' ? 'OVT' : 'BAL';
    this.ersBtn.textContent = `BATTERY · ${short}`;
  }

  setLimiter(on: boolean): void {
    this.limBtn.classList.toggle('down', on);
  }

  private setAuto(auto: boolean): void {
    this.auto = auto;
    this.modeBtn.textContent = auto ? 'AUTO' : 'MANUAL';
    this.modeBtn.className = `mode ${auto ? 'auto' : 'manual'}`;
    this.cb.onAuto(auto);
  }

  dispose(): void {
    this.root.remove();
  }
}
