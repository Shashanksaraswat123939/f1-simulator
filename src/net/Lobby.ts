/** Multiplayer lobby overlay: create or join a party, pick a driver, and (host) set up the race. */
import type { DriverDef, TeamDef, TrackDefinition, WeatherPreset } from '../core/types';
import { MAX_PLAYERS, Net, makeCode, normaliseCode, type LobbySettings, type StartPlan } from './Net';

const CSS = `
.lb{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(6,7,10,.82);
  font-family:"Inter","Segoe UI",Roboto,Arial,sans-serif;color:#f4f5f7;-webkit-user-select:none;user-select:none}
.lb.on{display:flex}
.lb *{box-sizing:border-box}
.lb-panel{width:min(560px,94vw);max-height:92vh;overflow:auto;background:#13151a;border:1px solid rgba(255,255,255,.14);border-radius:6px;padding:22px 22px 18px}
.lb h2{margin:0 0 4px;font-size:22px;font-weight:700;letter-spacing:-.01em}
.lb .sub{color:#8d929c;font-size:13px;margin-bottom:16px}
.lb .row{display:flex;gap:8px;margin:8px 0;align-items:center}
.lb label{flex:0 0 96px;font-size:11px;letter-spacing:.12em;font-weight:600;color:#8d929c}
.lb select,.lb input{flex:1;min-width:0;background:#0d0e12;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:4px;padding:9px 10px;font:600 14px inherit}
.lb input{letter-spacing:.3em;text-transform:uppercase;text-align:center;font-size:18px}
.lb button{appearance:none;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.05);color:#fff;border-radius:4px;padding:11px 16px;font:700 13px inherit;letter-spacing:.1em;cursor:pointer}
.lb button:hover{background:#fff;color:#0b0c0f}
.lb button.primary{background:#fff;color:#0b0c0f;border-color:#fff}
.lb button.primary:hover{background:#e10600;border-color:#e10600;color:#fff}
.lb button:disabled{opacity:.35;cursor:default;pointer-events:none}
.lb .btns{display:flex;gap:8px;margin-top:16px}
.lb .btns button{flex:1}
.lb .code{font:800 38px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.22em;text-align:center;padding:14px 0;border:1px dashed rgba(255,255,255,.25);border-radius:4px;margin:6px 0 8px}
.lb .roster{margin:12px 0;border:1px solid rgba(255,255,255,.1);border-radius:4px}
.lb .p{display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.07);font-size:14px;font-weight:600}
.lb .p:last-child{border-bottom:0}
.lb .p i{width:4px;align-self:stretch;border-radius:2px}
.lb .p small{margin-left:auto;color:#8d929c;font-weight:600;letter-spacing:.08em;font-size:11px}
.lb .st{font-size:12px;color:#8d929c;margin-top:10px;min-height:16px}
.lb-banner{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:55;display:none;background:rgba(19,21,26,.92);border:1px solid rgba(255,255,255,.18);
  border-radius:4px;padding:8px 14px;font:700 12px "Inter","Segoe UI",Arial,sans-serif;letter-spacing:.1em;color:#fff}
.lb-banner.on{display:block}
`;

export interface LobbyDeps {
  circuits: TrackDefinition[];
  drivers: DriverDef[];
  teams: Record<string, TeamDef>;
  defaultDriverId: string;
  onPlan: (plan: StartPlan, net: Net) => void;
  onGo: () => void;
}

const LAPS = [3, 5, 8, 10];
const WEATHERS: { v: WeatherPreset; l: string }[] = [
  { v: 'dry', l: 'Dry' },
  { v: 'light-rain', l: 'Light rain' },
  { v: 'heavy-rain', l: 'Heavy rain' },
  { v: 'dynamic', l: 'Changing weather' },
];
const EVENTS = ['Off', 'Normal', 'Frequent', 'Chaos'];

export class Lobby {
  net: Net | null = null;
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly banner: HTMLElement;
  private driverId: string;
  private settings: LobbySettings;

  constructor(private readonly deps: LobbyDeps) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.className = 'lb';
    this.panel = document.createElement('div');
    this.panel.className = 'lb-panel';
    this.root.appendChild(this.panel);
    this.banner = document.createElement('div');
    this.banner.className = 'lb-banner';
    document.body.append(this.root, this.banner);
    this.driverId = deps.defaultDriverId;
    this.settings = { circuitId: deps.circuits[0].id, laps: 5, weather: 'dry', eventLevel: 0 };
  }

  open(joinCode?: string, hostNow = false): void {
    this.root.classList.add('on');
    if (joinCode) this.join(normaliseCode(joinCode));
    else if (hostNow) this.host();
    else this.renderChoice();
  }

  isOpen(): boolean {
    return this.root.classList.contains('on');
  }

  close(): void {
    this.root.classList.remove('on');
  }

  /** Called when the race begins: hide the lobby but keep the connection. */
  hideForRace(): void {
    this.close();
  }

  leave(): void {
    this.net?.leave();
    this.net = null;
    this.banner.classList.remove('on');
  }

  showBanner(text: string): void {
    this.banner.textContent = text;
    this.banner.classList.add('on');
  }

  hideBanner(): void {
    this.banner.classList.remove('on');
  }

  /* ───────────── screens ───────────── */

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  private renderChoice(): void {
    const p = this.panel;
    p.replaceChildren();
    p.append(this.el('h2', '', 'Multiplayer'), this.el('div', 'sub', `Race friends online, up to ${MAX_PLAYERS} players. Everyone drives an identical car.`));
    const create = this.el('button', 'primary', 'CREATE A PARTY');
    create.onclick = () => this.host();
    const row = this.el('div', 'row');
    const input = this.el('input');
    input.placeholder = 'PARTY CODE';
    input.maxLength = 6;
    const join = this.el('button', '', 'JOIN');
    join.onclick = () => {
      const code = normaliseCode(input.value);
      if (code.length === 6) this.join(code);
    };
    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') join.click();
    };
    input.onkeyup = (e) => e.stopPropagation();
    row.append(input, join);
    const back = this.el('button', '', 'BACK');
    back.onclick = () => this.close();
    const btns = this.el('div', 'btns');
    btns.append(create);
    const backRow = this.el('div', 'btns');
    backRow.append(back);
    p.append(btns, this.el('div', 'sub', ''), row, backRow);
  }

  private host(): void {
    this.leave();
    this.net = new Net(makeCode(), true, this.driverId, this.settings);
    this.wire(this.net);
    this.renderRoom();
  }

  private join(code: string): void {
    this.leave();
    this.net = new Net(code, false, this.driverId, this.settings);
    this.wire(this.net);
    this.renderRoom();
  }

  private wire(net: Net): void {
    net.onChange = () => this.renderRoom();
    net.onStart = (plan) => {
      this.hideForRace();
      this.deps.onPlan(plan, net);
    };
    net.onGo = () => this.deps.onGo();
    net.onClosed = (reason) => {
      this.leave();
      this.root.classList.add('on');
      this.renderChoice();
      const st = this.el('div', 'st', reason);
      this.panel.appendChild(st);
    };
  }

  private select(label: string, options: { v: string; l: string }[], value: string, onChange: (v: string) => void, enabled: boolean): HTMLElement {
    const row = this.el('div', 'row');
    const sel = this.el('select');
    for (const o of options) {
      const op = this.el('option', '', o.l);
      op.value = o.v;
      sel.appendChild(op);
    }
    sel.value = value;
    sel.disabled = !enabled;
    sel.onchange = () => onChange(sel.value);
    sel.onkeydown = (e) => e.stopPropagation();
    row.append(this.el('label', '', label), sel);
    return row;
  }

  private renderRoom(): void {
    const net = this.net;
    if (!net) return;
    const p = this.panel;
    p.replaceChildren();
    p.append(this.el('h2', '', net.isHost ? 'Your party' : 'Party'), this.el('div', 'sub', net.isHost ? 'Share this code or link with your friends.' : 'Waiting for the host to start the race.'));
    p.append(this.el('div', 'code', net.code));

    if (net.isHost) {
      const share = this.el('button', '', 'COPY INVITE LINK');
      share.onclick = () => {
        const url = `${location.origin}${location.pathname}?room=${net.code}`;
        void navigator.clipboard?.writeText(url).then(() => (share.textContent = 'COPIED'));
      };
      p.appendChild(share);
    }

    const roster = this.el('div', 'roster');
    const add = (peerId: string, driverId: string, tag: string) => {
      const d = this.deps.drivers.find((x) => x.id === driverId) ?? this.deps.drivers[0];
      const t = this.deps.teams[d.teamId];
      const row = this.el('div', 'p');
      const bar = this.el('i');
      bar.style.background = t?.primaryColor ?? '#888';
      row.append(bar, this.el('span', '', `${d.name}`), this.el('small', '', `${t?.shortName ?? ''}${tag ? ' · ' + tag : ''}`));
      roster.appendChild(row);
      void peerId;
    };
    const hostPeer = [...net.players.entries()].find(([, v]) => v.host);
    if (net.isHost) add(net.selfId, net.driverId, 'HOST · YOU');
    else if (hostPeer) add(hostPeer[0], hostPeer[1].driverId, 'HOST');
    if (!net.isHost) add(net.selfId, net.driverId, 'YOU');
    for (const [id, pl] of net.players) {
      if (pl.host) continue;
      add(id, pl.driverId, '');
    }
    p.appendChild(roster);

    p.appendChild(
      this.select(
        'DRIVER',
        this.deps.drivers.map((d) => ({ v: d.id, l: `${d.name} · ${this.deps.teams[d.teamId]?.shortName ?? ''}` })),
        net.driverId,
        (v) => {
          this.driverId = v;
          net.setDriver(v);
          this.renderRoom();
        },
        true,
      ),
    );

    const s = net.settings;
    const host = net.isHost;
    const upd = (patch: Partial<LobbySettings>) => {
      this.settings = { ...net.settings, ...patch };
      net.setSettings(this.settings);
      this.renderRoom();
    };
    p.appendChild(this.select('CIRCUIT', this.deps.circuits.map((c) => ({ v: c.id, l: c.name })), s.circuitId, (v) => upd({ circuitId: v }), host));
    p.appendChild(this.select('LAPS', LAPS.map((n) => ({ v: String(n), l: String(n) })), String(s.laps), (v) => upd({ laps: Number(v) }), host));
    p.appendChild(this.select('WEATHER', WEATHERS.map((w) => ({ v: w.v, l: w.l })), s.weather, (v) => upd({ weather: v as WeatherPreset }), host));
    p.appendChild(this.select('EVENTS', EVENTS.map((l, i) => ({ v: String(i), l })), String(s.eventLevel), (v) => upd({ eventLevel: Number(v) }), host));

    const btns = this.el('div', 'btns');
    const leave = this.el('button', '', 'LEAVE');
    leave.onclick = () => {
      this.leave();
      this.renderChoice();
    };
    btns.appendChild(leave);
    if (host) {
      const go = this.el('button', 'primary', 'START RACE');
      go.disabled = net.players.size < 1;
      go.onclick = () => net.start();
      btns.appendChild(go);
    }
    p.append(btns, this.el('div', 'st', net.status));
  }
}
