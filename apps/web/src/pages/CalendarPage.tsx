import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, useCalendarController, type DateSelectInfo, type DatesSetInfo, type EventClickInfo, type EventDropInfo, type EventResizeDoneInfo } from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import listPlugin from "@fullcalendar/react/list";
import interactionPlugin from "@fullcalendar/react/interaction";
import zhTw from "@fullcalendar/react/locales/zh-tw";
import type { BookingInstance, EditScope } from "@smsk/shared";
import { ConflictErr, isAdmin, isStaff, login, logout, useBookingMutations, useBookings, useCategories, useMe, useRooms } from "../api";
import { Button, Chip, Icon, Modal, Option, Segmented, cssColor, cx, useBigText, useDark, useIsMobile, useLocal, useToast } from "../ui";
import { BookingForm, initialForm, toInput, type FormValue } from "../components/BookingForm";
import { ConfirmDelete, ScopeDialog } from "../components/Dialogs";
import { addMinutes, fmtDate, fmtRange, fmtTime, roundTo } from "../lib/time";
import { describe, fromRRule } from "../lib/recur";

type Editor = { mode: "create" } | { mode: "edit"; inst: BookingInstance; scope: EditScope };
type Pending =
  | { kind: "edit"; inst: BookingInstance }
  | { kind: "delete"; inst: BookingInstance }
  | { kind: "move"; inst: BookingInstance; start: Date; end: Date; revert: () => void };

type ViewId = "timeGridDay" | "timeGridThreeDay" | "timeGridWeek" | "dayGridMonth" | "listWeek";
const VIEWS_DESKTOP: { value: ViewId; label: string }[] = [{ value: "timeGridDay", label: "日" }, { value: "timeGridWeek", label: "週" }, { value: "dayGridMonth", label: "月" }, { value: "listWeek", label: "清單" }];
const VIEWS_MOBILE: { value: ViewId; label: string }[] = [{ value: "timeGridDay", label: "日" }, { value: "timeGridThreeDay", label: "三日" }, { value: "listWeek", label: "清單" }];
const NAV: Record<ViewId, [string, string]> = { timeGridDay: ["前一天", "後一天"], timeGridThreeDay: ["前三天", "後三天"], timeGridWeek: ["上一週", "下一週"], dayGridMonth: ["上個月", "下個月"], listWeek: ["上一週", "下一週"] };
const DOW = ["日", "一", "二", "三", "四", "五", "六"];
/** 中文標題：日「8月16日（週日）」、週/三日/清單「8月16日 – 22日」、月「2026年8月」 */
function fmtTitle(view: ViewId, s: Date, eExclusive: Date) {
  const e = new Date(eExclusive.getTime() - 1);
  if (view === "dayGridMonth") { const mid = new Date((s.getTime() + e.getTime()) / 2); return `${mid.getFullYear()}年${mid.getMonth() + 1}月`; }
  if (view === "timeGridDay") return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日（週${DOW[s.getDay()]}）`;
  const sameMonth = s.getMonth() === e.getMonth();
  return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日 – ${sameMonth ? "" : `${e.getMonth() + 1}月`}${e.getDate()}日`;
}

export function CalendarPage() {
  const me = useMe().data ?? null;
  const rooms = useRooms().data ?? [];
  const categories = useCategories().data ?? [];
  const mobile = useIsMobile();
  const [dark, toggleDark] = useDark();
  const [big, toggleBig] = useBigText();
  const toast = useToast();
  const { create, patch, remove } = useBookingMutations();
  const cal = useCalendarController();

  const [range, setRange] = useState<{ from: Date; to: Date } | null>(null);
  const [view, setView] = useLocal<ViewId>("smsk.view", mobile ? "timeGridThreeDay" : "timeGridWeek");
  const viewOptions = mobile ? VIEWS_MOBILE : VIEWS_DESKTOP;
  const activeView: ViewId = viewOptions.some((v) => v.value === view) ? view : mobile ? "timeGridThreeDay" : "timeGridWeek";
  const bookings = useBookings(range?.from ?? null, range?.to ?? null);
  const [hidden, setHidden] = useLocal<number[]>("smsk.hiddenRooms", []);
  const [axis, setAxis] = useLocal<"room" | "category">("smsk.axis", "room");
  const activeRooms = rooms.filter((r) => r.active);
  const shown = (id: number) => !hidden.includes(id);
  const hiddenCount = activeRooms.filter((r) => !shown(r.id)).length;

  const [detail, setDetail] = useState<BookingInstance | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ inst: BookingInstance; scope: EditScope } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [form, setForm] = useState<FormValue | null>(null);
  const [conflicts, setConflicts] = useState<null | ConflictErr["conflicts"]>(null);
  const [force, setForce] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);

  const roomOf = (id: number) => rooms.find((r) => r.id === id);
  const catOf = (id: number) => categories.find((c) => c.id === id);
  const canEdit = (b: BookingInstance) => !!me && (b.mine || isStaff(me));

  const events = useMemo(
    () => (bookings.data ?? []).filter((b) => shown(b.roomId)).map((b) => ({
      id: b.id, title: b.title, start: b.start, end: b.end, editable: canEdit(b), extendedProps: { b },
    })),
    [bookings.data, hidden, me, axis, rooms, categories],
  );

  // ---- open editor ----
  const openCreate = (start?: Date, end?: Date) => {
    if (!me) return toast("info", "請先用 LINE 登入，才能登記場地");
    const s = start ?? roundTo(new Date(), 30);
    let e = end ?? addMinutes(s, 60);
    if (e.getDate() !== s.getDate()) e = new Date(s.getFullYear(), s.getMonth(), s.getDate(), 23, 59); // late night: don't cross midnight
    setForm(initialForm({ start: s, end: e, roomId: activeRooms.find((r) => shown(r.id))?.id ?? activeRooms[0]?.id, categoryId: categories.find((c) => c.active)?.id }));
    setConflicts(null); setForce(false); setErr(null); setEditor({ mode: "create" });
  };
  const openEdit = (inst: BookingInstance, scope: EditScope) => {
    const base = scope === "all" ? { start: new Date(inst.seriesStart), end: new Date(inst.seriesEnd) } : { start: new Date(inst.start), end: new Date(inst.end) };
    setForm(initialForm({ ...base, roomId: inst.roomId, categoryId: inst.categoryId, title: inst.title, note: inst.note, rrule: scope === "this" ? null : inst.rrule }));
    setConflicts(null); setForce(false); setErr(null); setDetail(null); setEditor({ mode: "edit", inst, scope });
  };
  const closeEditor = () => { setEditor(null); setForm(null); };

  const submit = async () => {
    if (!editor || !form) return;
    const input = toInput(form, force);
    if (typeof input === "string") return setErr(input);
    setErr(null);
    try {
      if (editor.mode === "create") { await create.mutateAsync(input); toast("ok", "登記成功！已加到行事曆"); }
      else {
        const { force: f, rrule, ...fields } = input;
        const patchBody = editor.scope === "this" ? fields : { ...fields, rrule };
        await patch.mutateAsync({ id: editor.inst.seriesId, scope: editor.scope, occurrenceStart: editor.inst.occurrenceStart, patch: patchBody, force: f });
        toast("ok", "已儲存修改");
      }
      closeEditor();
    } catch (e) {
      if (e instanceof ConflictErr) { setConflicts(e.conflicts); setForce(false); }
      else setErr(`儲存失敗，請再試一次（${(e as Error).message}）`);
    }
  };

  // ---- delete ----
  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      await remove.mutateAsync({ id: confirmDel.inst.seriesId, scope: confirmDel.scope, occurrenceStart: confirmDel.inst.occurrenceStart });
      toast("ok", "已刪除登記"); setConfirmDel(null); setDetail(null);
    } catch (e) { toast("err", `刪除失敗，請再試一次（${(e as Error).message}）`); }
  };

  // ---- drag / resize ----
  const onMoved = (inst: BookingInstance, start: Date, end: Date, revert: () => void) => {
    if (inst.recurring) setPending({ kind: "move", inst, start, end, revert });
    else applyMove(inst, "all", start, end, revert);
  };
  const applyMove = async (inst: BookingInstance, scope: EditScope, start: Date, end: Date, revert: () => void) => {
    let s = start, e = end;
    if (scope === "all") { // whole series shifts by the same delta as this occurrence
      const delta = start.getTime() - new Date(inst.start).getTime();
      s = new Date(new Date(inst.seriesStart).getTime() + delta);
      e = new Date(s.getTime() + (end.getTime() - start.getTime()));
    }
    try {
      await patch.mutateAsync({ id: inst.seriesId, scope, occurrenceStart: inst.occurrenceStart, patch: { start: s.toISOString(), end: e.toISOString() }, force: false });
      toast("ok", `已移到 ${fmtRange(start, end)}`);
    } catch (er) {
      revert();
      if (er instanceof ConflictErr) toast("err", `時段衝突：${roomOf(er.conflicts[0].roomId)?.name ?? ""}已有「${er.conflicts[0].title}」${fmtRange(new Date(er.conflicts[0].start), new Date(er.conflicts[0].end))}，已放回原位`);
      else toast("err", `移動失敗，已放回原位（${(er as Error).message}）`);
    }
  };
  const onDrop = (i: EventDropInfo) => onMoved(i.event.extendedProps.b, i.event.start!, i.event.end!, i.revert);
  const onResize = (i: EventResizeDoneInfo) => onMoved(i.event.extendedProps.b, i.event.start!, i.event.end!, i.revert);

  const pickScope = (scope: EditScope) => {
    if (!pending) return;
    const p = pending; setPending(null);
    if (p.kind === "edit") openEdit(p.inst, scope);
    else if (p.kind === "delete") setConfirmDel({ inst: p.inst, scope });
    else applyMove(p.inst, scope, p.start, p.end, p.revert);
  };
  const cancelPending = () => { if (pending?.kind === "move") pending.revert(); setPending(null); };

  const isList = activeView === "listWeek";
  const title = range ? fmtTitle(activeView, range.from, range.to) : "";
  const [prevLabel, nextLabel] = NAV[activeView];

  return (
    <div className="min-h-dvh bg-bg text-fg">
      {/* ---- header ---- */}
      <header className="flex items-center gap-3 px-3 py-3 md:px-6">
        <h1 className="font-display text-xl font-bold leading-tight text-primary md:text-2xl">石門教會 <span className="whitespace-nowrap">場地登記</span></h1>
        <div className="ml-auto flex items-center gap-2">
          {mobile ? (
            <button onClick={() => setSettings(true)} className="inline-flex min-h-[44px] items-center gap-2 rounded-pill border-2 border-border bg-surface py-1 pl-1.5 pr-3.5 text-sm font-bold">
              {me?.image ? <img src={me.image} className="h-8 w-8 rounded-full" alt="" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-soft text-primary"><Icon name={me ? "user" : "settings"} size={18} /></span>}
              {me ? <span className="max-w-[6em] truncate">{me.name}</span> : "設定"}
            </button>
          ) : (
            <>
              <ToggleBtn on={big} onClick={toggleBig} icon="text" title="放大字體">大字</ToggleBtn>
              <ToggleBtn on={false} onClick={toggleDark} icon={dark ? "sun" : "moon"} title="切換深色／淺色">{dark ? "淺色" : "深色"}</ToggleBtn>
              {isAdmin(me) && <Link to="/admin" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border-2 border-primary bg-surface px-4 text-sm font-bold text-primary"><Icon name="settings" size={18} />管理後台</Link>}
              {me ? (
                <div className="flex items-center gap-2 rounded-pill border-2 border-border bg-surface py-1 pl-1 pr-1">
                  {me.image ? <img src={me.image} className="h-8 w-8 rounded-full" alt="" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-soft text-primary"><Icon name="user" size={18} /></span>}
                  <span className="max-w-[7em] truncate text-sm font-bold">{me.name}</span>
                  <button onClick={logout} className="inline-flex min-h-[36px] items-center gap-1 rounded-pill px-3 text-sm text-muted hover:bg-primary/10 hover:text-fg"><Icon name="log-out" size={16} />登出</button>
                </div>
              ) : (
                <Button onClick={login} className="!border-[#06C755] !bg-[#06C755] !text-white">用 LINE 登入</Button>
              )}
            </>
          )}
        </div>
      </header>

      {/* mobile settings sheet */}
      <Modal open={settings} onClose={() => setSettings(false)} title="設定" icon="settings">
        <div className="flex flex-col gap-2">
          {me && (
            <div className="mb-1 flex items-center gap-3 rounded-md bg-bg px-4 py-3">
              {me.image ? <img src={me.image} className="h-10 w-10 rounded-full" alt="" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-soft text-primary"><Icon name="user" size={22} /></span>}
              <div className="min-w-0 flex-1"><div className="truncate text-base font-bold">{me.name}</div><div className="text-sm text-muted">{isAdmin(me) ? "管理員" : isStaff(me) ? "幹事" : "會友"}</div></div>
              <Button size="sm" variant="ghost" icon="log-out" onClick={logout}>登出</Button>
            </div>
          )}
          <Option radio={false} on={big} onClick={toggleBig} title="大字模式" note="把整個畫面的字放大" />
          <Option radio={false} on={dark} onClick={toggleDark} title="深色模式" note="晚上看比較不刺眼" />
          <div className="mt-2 flex items-center justify-between gap-3 rounded-md border-2 border-border px-4 py-3">
            <span className="text-base font-bold">登記顏色依</span>
            <Segmented size="sm" label="顏色依場地或類別" value={axis} onChange={setAxis} options={[{ value: "room", label: "場地" }, { value: "category", label: "類別" }]} />
          </div>
          {isAdmin(me) && <Link to="/admin" className="mt-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-pill border-2 border-primary text-base font-bold text-primary"><Icon name="settings" size={20} />管理後台</Link>}
          {!me && <Button className="mt-2 !border-[#06C755] !bg-[#06C755] !text-white" onClick={login}>用 LINE 登入</Button>}
        </div>
      </Modal>

      {!me && (
        <div className="mx-3 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border-2 border-primary/30 bg-surface px-4 py-3 text-base md:mx-6">
          <Icon name="info" size={22} className="text-primary" />
          <div className="flex-1 leading-snug"><b>未登入也可以查看行事曆。</b><span className="text-muted">想登記場地，請先用 LINE 登入。</span></div>
          <Button size="sm" onClick={login} className="!border-[#06C755] !bg-[#06C755] !text-white">用 LINE 登入</Button>
        </div>
      )}

      {/* ---- date navigation ---- */}
      <div className="flex flex-wrap items-center gap-2 px-3 pb-2 md:px-6">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => cal.prev()} aria-label={prevLabel}><Icon name="chevron-left" size={20} /><span className="hidden sm:inline">{prevLabel}</span></Button>
          <Button variant="ghost" size="sm" onClick={() => cal.today()}>今天</Button>
          <Button variant="ghost" size="sm" onClick={() => cal.next()} aria-label={nextLabel}><span className="hidden sm:inline">{nextLabel}</span><Icon name="chevron-right" size={20} /></Button>
        </div>
        <h2 className="font-display text-lg font-bold text-primary md:text-xl" aria-live="polite">{title}</h2>
        <div className="ml-auto flex items-center gap-2">
          {bookings.isFetching && <span className="text-sm text-muted">載入中…</span>}
          <Segmented size={mobile ? "sm" : "md"} label="切換檢視" value={activeView} onChange={(v) => { setView(v); cal.changeView(v); }} options={viewOptions} />
        </div>
      </div>

      {/* ---- room filter ---- */}
      <div className="flex flex-wrap items-center gap-2 px-3 pb-3 md:px-6">
        <span className="text-sm font-bold text-muted">顯示場地</span>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible">
          {activeRooms.map((r) => (
            <Chip key={r.id} size="sm" check on={shown(r.id)} color={cssColor(r.colorToken)} onClick={() => setHidden((h) => (h.includes(r.id) ? h.filter((x) => x !== r.id) : [...h, r.id]))}>{r.name}</Chip>
          ))}
          {hiddenCount > 0 && <Chip size="sm" on={false} onClick={() => setHidden([])} className="!border-primary !text-primary">全部顯示</Chip>}
        </div>
        {!mobile && (
          <div className="flex flex-none items-center gap-1.5">
            <span className="text-sm font-bold text-muted">顏色依</span>
            <Segmented size="sm" label="顏色依場地或類別" value={axis} onChange={setAxis} options={[{ value: "room", label: "場地" }, { value: "category", label: "類別" }]} />
          </div>
        )}
      </div>

      {/* ---- calendar ---- */}
      <div className="px-2 pb-28 md:px-6 md:pb-8">
        <Calendar
          key={mobile ? "m" : "d"}
          controller={cal}
          plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
          locale={zhTw}
          initialView={activeView}
          views={{ timeGridThreeDay: { type: "timeGrid", duration: { days: 3 } }, listWeek: { type: "list", duration: { days: 7 } } }}
          headerToolbar={false}
          height="auto"
          slotMinTime="06:00:00" slotMaxTime="23:00:00" slotDuration="00:30:00" snapDuration="00:15:00" slotHeaderInterval="01:00"
          allDaySlot={false} nowIndicator expandRows dayMaxEvents={4}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          slotHeaderFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          dayHeaderContent={(d) => (d.view.type === "dayGridMonth" ? `週${DOW[d.date.getDay()]}` : `週${DOW[d.date.getDay()]} ${d.date.getDate()}`)}
          noEventsText="這一週沒有任何登記" listDayAltFormat={false}
          editable={!!me} selectable={!!me} selectMirror eventResizableFromStart
          eventLongPressDelay={500} selectLongPressDelay={500}
          datesSet={(i: DatesSetInfo) => setRange({ from: i.start, to: i.end })}
          events={events}
          viewClass="rounded-lg border-2 border-border bg-surface overflow-hidden"
          dayHeaderClass="py-2.5 text-center text-sm md:text-base font-bold border-b-2 border-border"
          dayHeaderInnerClass={(d) => (d.isToday ? "text-primary underline underline-offset-4 decoration-2" : "")}
          dayCellClass={(d) => cx("border border-border/60 min-h-[6rem]", d.isToday && "bg-today", d.isOther && "opacity-50")}
          dayCellTopInnerClass="px-2 py-1 text-sm font-bold"
          dayLaneClass={(d) => cx("border-l border-border/60", d.isToday && "bg-today")}
          slotLaneClass="border-t border-border/40 h-11 md:h-12"
          slotHeaderClass="pr-2 text-xs md:text-sm text-muted text-right"
          nowIndicatorLineClass="border-t-2 border-danger"
          nowIndicatorDotClass="bg-danger"
          listDayHeaderClass="sticky top-0 z-10 border-b-2 border-border bg-bg px-4 py-2.5 font-display text-base font-bold text-primary"
          listDayHeaderContent={(d) => d.level > 0 ? null : <span className="flex items-center gap-2">{`${d.date.getMonth() + 1}月${d.date.getDate()}日（週${DOW[d.date.getDay()]}）`}{d.isToday && <span className="rounded-pill bg-primary px-2 py-0.5 text-xs text-primary-fg">今天</span>}</span>}
          listItemEventClass="border-b border-border/60 last:border-b-0 hover:bg-today cursor-pointer"
          listItemEventInnerClass="px-3 py-3"
          moreLinkClass="text-sm font-bold text-primary px-1"
          moreLinkText={(n) => `還有 ${n} 筆`}
          eventClass={(i) => cx(!isList && "group rounded-sm text-white shadow-sm ring-1 ring-black/10 overflow-hidden", (i.isDragging || i.isResizing) && "opacity-70", i.isMirror && "opacity-60")}
          eventInnerClass={isList ? "" : activeView === "dayGridMonth" ? "px-1.5 py-0.5 leading-tight relative isolate" : "pl-2.5 pr-1.5 py-0.5 leading-tight relative isolate h-full"}
          /* resize handles (top/bottom edge): 8px hit area, cursor hint, grip visible on hover */
          eventBeforeClass={(i) => cx(!isList && "absolute inset-x-0 top-0 h-2 z-10", i.isStartResizable && "cursor-ns-resize")}
          eventAfterClass={(i) => cx(!isList && "absolute inset-x-0 bottom-0 h-2 z-10", i.isEndResizable && "cursor-ns-resize after:absolute after:left-1/2 after:bottom-0.5 after:h-1 after:w-6 after:-translate-x-1/2 after:rounded-full after:bg-white/70 after:opacity-0 group-hover:after:opacity-100")}
          eventContent={(i) => {
            const b = i.event.extendedProps.b as BookingInstance | undefined;
            if (!b) return <div className="h-full bg-primary/60 px-1 text-xs text-white">{i.timeText}</div>;
            const room = roomOf(b.roomId), cat = catOf(b.categoryId);
            const fill = cssColor((axis === "room" ? room?.colorToken : cat?.colorToken) ?? "room-10");
            const stripe = cssColor((axis === "room" ? cat?.colorToken : room?.colorToken) ?? "cat-personal");
            if (i.view.type.startsWith("list")) {
              return (
                <div className="flex items-center gap-3">
                  <span className="h-10 w-2 flex-none rounded-full" style={{ background: fill }} />
                  <div className="w-[7.5em] flex-none text-base font-bold tabular-nums">{fmtTime(new Date(b.start))}–{fmtTime(new Date(b.end))}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-bold">{b.title}{b.recurring && <Icon name="repeat" size={14} className="ml-1 inline text-muted" />}</div>
                    <div className="truncate text-sm text-muted">{room?.name} · {cat?.name}{b.user ? ` · ${b.user.name}` : ""}</div>
                  </div>
                  <Icon name="chevron-right" size={18} className="text-muted" />
                </div>
              );
            }
            const month = i.view.type === "dayGridMonth";
            return (
              <div className={cx("text-xs md:text-sm", month && "flex items-center gap-1")}>
                {/* FC v7 class-mode ignores event.backgroundColor → paint our own fill layer */}
                <span className="absolute inset-0 -z-10" style={{ background: fill }} />
                {!month && <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: stripe }} />}
                {month ? (
                  <><span className="opacity-90">{i.timeText}</span><span className="truncate font-bold">{b.title}</span></>
                ) : (
                  <>
                    <div className="truncate font-bold">{b.title}{b.recurring && <Icon name="repeat" size={12} className="ml-1 inline" />}</div>
                    <div className="truncate opacity-90">{i.timeText}<span className="hidden md:inline"> · {axis === "room" ? cat?.name : room?.name}</span></div>
                    {b.user && <div className="hidden truncate opacity-75 md:block">{b.user.name}</div>}
                  </>
                )}
              </div>
            );
          }}
          eventClick={(i: EventClickInfo) => setDetail(i.event.extendedProps.b)}
          select={(i: DateSelectInfo) => openCreate(i.start, i.end)}
          eventDrop={onDrop}
          eventResize={onResize}
        />
        {bookings.isError && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border-2 border-danger bg-surface px-4 py-3 text-base"><Icon name="alert" className="text-danger" /><span className="flex-1">行事曆載入失敗，請檢查網路。</span><Button size="sm" variant="ghost" onClick={() => bookings.refetch()}>再試一次</Button></div>
        )}
        {me && !isList && (
          <p className="mt-3 text-sm text-muted">小提示：按右下角「新增登記」，或直接在空白時段按住往下拖選時間。點一下登記可看詳情、修改或刪除。</p>
        )}
      </div>

      {me && (
        <button onClick={() => openCreate()}
          className="fixed bottom-6 right-4 z-30 flex min-h-[56px] items-center gap-2 rounded-pill bg-primary pl-4 pr-6 text-lg font-bold text-primary-fg shadow-[0_8px_20px_rgba(46,95,102,.35)] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:bottom-8 md:right-8">
          <Icon name="plus" size={26} />新增登記
        </button>
      )}

      {/* detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title}>
        {detail && (() => {
          const s = new Date(detail.start), e = new Date(detail.end);
          const room = roomOf(detail.roomId), cat = catOf(detail.categoryId);
          const Row = ({ icon, children }: { icon: Parameters<typeof Icon>[0]["name"]; children: ReactNode }) => (
            <div className="flex items-start gap-3 text-base leading-snug"><Icon name={icon} size={22} className="mt-0.5 shrink-0 text-primary" /><div className="min-w-0 flex-1">{children}</div></div>
          );
          return (
            <div className="flex flex-col gap-3">
              <Row icon="clock">
                <div className="font-bold">{fmtDate(s)} {fmtTime(s)}–{fmtTime(e)}</div>
                {detail.recurring && <div className="text-sm text-muted">重複：{describe(fromRRule(detail.rrule), new Date(detail.seriesStart))}</div>}
              </Row>
              <Row icon="pin">
                <div className="flex flex-wrap items-center gap-2">
                  {room && <span className="inline-flex items-center gap-1.5 font-bold"><span className="inline-block h-3.5 w-3.5 rounded-[4px]" style={{ background: cssColor(room.colorToken) }} />{room.name}</span>}
                  {cat && <span className="inline-flex items-center gap-1.5 text-muted"><span className="inline-block h-3.5 w-3.5 rounded-[4px]" style={{ background: cssColor(cat.colorToken) }} />{cat.name}</span>}
                </div>
              </Row>
              <Row icon="user">
                {detail.user ? (
                  <span className="inline-flex items-center gap-2">{detail.user.image ? <img src={detail.user.image} className="h-7 w-7 rounded-full" alt="" /> : null}{detail.user.name}{detail.mine && <span className="rounded-pill bg-today px-2 py-0.5 text-xs font-bold text-primary">我的登記</span>}</span>
                ) : <span className="text-muted">登入後可看到登記人</span>}
              </Row>
              {detail.note && <div className="rounded-md bg-bg px-3.5 py-2.5 text-base leading-relaxed whitespace-pre-wrap"><span className="font-bold text-primary">備註：</span>{detail.note}</div>}
              {canEdit(detail) ? (
                <div className="mt-2 flex gap-2">
                  <Button className="flex-[2]" icon="edit" onClick={() => (detail.recurring ? setPending({ kind: "edit", inst: detail }) : openEdit(detail, "all"))}>修改</Button>
                  <Button variant="danger" className="flex-1" icon="trash" onClick={() => (detail.recurring ? setPending({ kind: "delete", inst: detail }) : setConfirmDel({ inst: detail, scope: "all" }))}>刪除</Button>
                </div>
              ) : (
                <div className="mt-1 rounded-md bg-bg px-3.5 py-2.5 text-sm text-muted">{me ? "只有登記人本人或幹事可以修改這筆登記。" : "登入後，可以修改自己的登記。"}</div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* editor */}
      <Modal open={!!editor && !!form} onClose={closeEditor} title={editor?.mode === "create" ? "新增登記" : editor?.scope === "this" ? "修改這一次" : editor?.scope === "following" ? "修改這次和之後" : "修改登記"}>
        {editor && form && (
          <BookingForm value={form} onChange={setForm} rooms={rooms} categories={categories}
            conflicts={conflicts} canForce={isStaff(me)} force={force} onForce={setForce}
            allowRepeat={editor.mode === "create" || editor.scope !== "this"}
            submitLabel={editor.mode === "create" ? "確認登記" : "儲存修改"} busy={create.isPending || patch.isPending}
            onSubmit={submit} onCancel={closeEditor} error={err} />
        )}
      </Modal>

      <ScopeDialog open={!!pending} onClose={cancelPending} onPick={pickScope}
        verb={pending?.kind === "delete" ? "刪除" : "修改"} title={pending?.inst.title ?? ""}
        occurrenceLabel={pending ? fmtDate(new Date(pending.inst.start)) : ""} />
      <ConfirmDelete open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={doDelete} busy={remove.isPending}
        summary={confirmDel ? `${confirmDel.inst.title} · ${fmtRange(new Date(confirmDel.inst.start), new Date(confirmDel.inst.end))} · ${roomOf(confirmDel.inst.roomId)?.name ?? ""}${confirmDel.scope === "all" && confirmDel.inst.recurring ? "（整個系列）" : confirmDel.scope === "following" ? "（這次和之後全部）" : ""}` : ""} />
    </div>
  );
}

function ToggleBtn({ on, onClick, icon, title, children }: { on: boolean; onClick: () => void; icon: Parameters<typeof Icon>[0]["name"]; title: string; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} title={title} className={cx("inline-flex min-h-[44px] items-center gap-1.5 rounded-pill border-2 px-4 text-sm font-bold", on ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg hover:bg-primary/10")}>
      <Icon name={icon} size={18} />{children}
    </button>
  );
}
