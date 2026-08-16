import { useEffect, useMemo, useState } from "react";
import { Calendar, type EventClickInfo, type EventDropInfo, type EventResizeDoneInfo } from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import rrulePlugin from "@fullcalendar/rrule";
import zhTw from "@fullcalendar/react/locales/zh-tw";
import { BOOKINGS, ROOMS } from "./data";

// Tailwind v4 需要靜態 class 字串才掃得到
const ROOM_BG: Record<number, string> = {
  1: "bg-room-1", 2: "bg-room-2", 3: "bg-room-3", 4: "bg-room-4", 5: "bg-room-5",
  6: "bg-room-6", 7: "bg-room-7", 8: "bg-room-8", 9: "bg-room-9", 10: "bg-room-10",
};

type Popover = { x: number; y: number; title: string; room: string; user: string; time: string; series?: string };

export function App() {
  const [shown, setShown] = useState<Set<number>>(new Set(ROOMS.map((r) => r.id)));
  const [dark, setDark] = useState(false);
  const [pop, setPop] = useState<Popover | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const push = (s: string) => setLog((l) => [s, ...l].slice(0, 8));

  // POC 2: better-auth session（同源 /api，cookie 自動帶）
  const [me, setMe] = useState<{ name: string; role?: string; image?: string } | null>(null);
  useEffect(() => { fetch("/api/me").then((r) => (r.ok ? r.json() : null)).then(setMe).catch(() => setMe(null)); }, []);
  const login = async () => {
    const r = await fetch("/api/auth/sign-in/oauth2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerId: "line", callbackURL: "/" }) });
    const { url } = await r.json(); window.location.href = url;
  };
  const logout = async () => { await fetch("/api/auth/sign-out", { method: "POST" }); setMe(null); };

  const events = useMemo(
    () =>
      BOOKINGS.filter((b) => shown.has(b.roomId)).map((b) => ({
        id: b.id, title: b.title, start: b.start, end: b.end,
        rrule: b.rrule, duration: b.duration, exdate: b.exdate,
        extendedProps: { roomId: b.roomId, user: b.user, isSeries: !!b.rrule },
      })),
    [shown],
  );

  const describe = (e: EventClickInfo["event"]) =>
    `id=${e.id} start=${e.start?.toLocaleString("zh-TW")} end=${e.end?.toLocaleString("zh-TW")} series=${e.extendedProps.isSeries}`;

  const onDrop = (i: EventDropInfo) => {
    // POC #5: 週期事件的 occurrence 被拖時，callback 給什麼？
    push(`DROP ${describe(i.event)} | old=${i.oldEvent.start?.toLocaleString("zh-TW")} delta=${JSON.stringify(i.delta)}`);
    if (i.event.extendedProps.isSeries) i.revert(); // series 寫回策略由 app 決定，POC 先還原
  };
  const onResize = (i: EventResizeDoneInfo) => push(`RESIZE ${describe(i.event)}`);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-bg text-fg p-3 md:p-6 space-y-3">
        <header className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-xl font-bold text-primary">石門教會場地登記 · POC</h1>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {me ? (<>
              {me.image && <img src={me.image} className="h-7 w-7 rounded-full" alt="" />}
              <span>{me.name} <span className="opacity-60">({me.role ?? "member"})</span></span>
              <button className="rounded-full border-2 border-primary px-3 py-1" onClick={logout}>登出</button>
            </>) : (
              <button className="rounded-full bg-[#06C755] px-3 py-1 font-semibold text-white" onClick={login}>LINE 登入</button>
            )}
          </div>
          <button className="rounded-full border-2 border-primary px-3 py-1 text-sm" onClick={() => setDark(!dark)}>
            {dark ? "亮" : "暗"}
          </button>
        </header>

        {/* POC #3 房間篩選 */}
        <div className="flex flex-wrap gap-2">
          {ROOMS.map((r) => (
            <label key={r.id} className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm cursor-pointer border-2 select-none ${shown.has(r.id) ? `${ROOM_BG[r.id]} text-white border-transparent` : "border-border text-muted"}`}>
              <input type="checkbox" className="hidden" checked={shown.has(r.id)}
                onChange={() => setShown((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} />
              {r.name}
            </label>
          ))}
        </div>

        <Calendar
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, rrulePlugin]}
          locale={zhTw}
          initialView="timeGridWeek"
          headerToolbar={{ start: "prev,next today", center: "title", end: "timeGridDay,timeGridWeek,dayGridMonth" }}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="23:00:00"
          allDaySlot={false}
          nowIndicator
          editable
          selectable
          eventLongPressDelay={400}
          events={events}
          /* POC #2：只用 class props，不寫 .fc-* override */
          headerToolbarClass="mb-3 flex flex-wrap items-center gap-2"
          toolbarTitleClass="font-display text-lg font-bold text-primary"
          buttonClass={(b) => `rounded-full px-3 py-1 text-sm font-semibold border-2 border-primary ${b.isSelected ? "bg-primary text-primary-fg" : "text-primary hover:bg-primary/10"}`}
          buttonGroupClass="flex gap-1"
          viewClass="rounded-lg border-2 border-border bg-surface overflow-hidden"
          dayHeaderClass="py-2 text-center text-sm font-semibold border-b border-border"
          dayHeaderInnerClass={(d) => (d.isToday ? "text-primary underline underline-offset-4" : "")}
          dayCellClass={(d) => `border border-border/60 ${d.isToday ? "bg-today" : ""}`}
          dayLaneClass={(d) => `border-l border-border/60 ${d.isToday ? "bg-today" : ""}`}
          slotLaneClass="border-t border-border/40"
          slotHeaderClass="pr-2 text-xs text-muted text-right"
          nowIndicatorLineClass="border-t-2 border-danger"
          nowIndicatorDotClass="bg-danger"
          eventClass={(i) => `${ROOM_BG[i.event.extendedProps.roomId as number]} rounded-sm text-white shadow-sm ring-1 ring-black/10 ${i.isDragging ? "opacity-70" : ""}`}
          eventInnerClass="px-1.5 py-0.5 leading-tight"
          eventContent={(i) => (
            <div className="text-[11px] md:text-xs">
              <div className="font-bold truncate">{i.event.title}{i.event.extendedProps.isSeries ? " ↻" : ""}</div>
              <div className="opacity-90 truncate">{i.timeText} · {ROOMS.find((r) => r.id === i.event.extendedProps.roomId)?.name}</div>
              <div className="opacity-75 truncate hidden md:block">{i.event.extendedProps.user}</div>
            </div>
          )}
          eventClick={(i) => {
            const r = i.el.getBoundingClientRect();
            setPop({
              x: Math.min(r.left, window.innerWidth - 280), y: r.bottom + window.scrollY + 4,
              title: i.event.title, user: i.event.extendedProps.user,
              room: ROOMS.find((x) => x.id === i.event.extendedProps.roomId)?.name ?? "",
              time: `${i.event.start?.toLocaleString("zh-TW")} – ${i.event.end?.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`,
              series: i.event.extendedProps.isSeries ? "週期登記（此筆 / 此後 / 全部 由 app 層處理）" : undefined,
            });
          }}
          eventDrop={onDrop}
          eventResize={onResize}
        />

        {pop && (
          <div className="fixed inset-0 z-40" onClick={() => setPop(null)}>
            <div className="absolute z-50 w-64 rounded-lg border-2 border-border bg-surface text-fg p-3 shadow-xl"
              style={{ left: pop.x, top: pop.y }} onClick={(e) => e.stopPropagation()}>
              <div className="font-display font-bold text-primary">{pop.title}</div>
              <div className="text-sm">{pop.time}</div>
              <div className="text-sm">{pop.room} · {pop.user}</div>
              {pop.series && <div className="mt-1 text-xs opacity-70">{pop.series}</div>}
            </div>
          </div>
        )}

        <pre className="text-[11px] whitespace-pre-wrap rounded-md bg-surface/70 p-2 border border-border">
          {log.length ? log.join("\n") : "拖曳 / resize 事件會印在這裡（POC #5）"}
        </pre>
      </div>
    </div>
  );
}
