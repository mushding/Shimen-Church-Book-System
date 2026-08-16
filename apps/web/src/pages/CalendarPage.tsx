import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, type DateSelectInfo, type DatesSetInfo, type EventClickInfo, type EventDropInfo, type EventResizeDoneInfo } from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import zhTw from "@fullcalendar/react/locales/zh-tw";
import type { BookingInstance, EditScope } from "@smsk/shared";
import { ConflictErr, isAdmin, isStaff, login, logout, useBookingMutations, useBookings, useCategories, useMe, useRooms } from "../api";
import { Button, Chip, Modal, Segmented, catBg, cx, roomBg, useDark, useIsMobile, useLocal, useToast } from "../ui";
import { BookingForm, initialForm, toInput, type FormValue } from "../components/BookingForm";
import { ConfirmDelete, ScopeDialog } from "../components/Dialogs";
import { addMinutes, fmtDate, fmtRange, fmtTime, roundTo } from "../lib/time";
import { describe, fromRRule } from "../lib/recur";

type Editor = { mode: "create" } | { mode: "edit"; inst: BookingInstance; scope: EditScope };
type Pending =
  | { kind: "edit"; inst: BookingInstance }
  | { kind: "delete"; inst: BookingInstance }
  | { kind: "move"; inst: BookingInstance; start: Date; end: Date; revert: () => void };

export function CalendarPage() {
  const me = useMe().data ?? null;
  const rooms = useRooms().data ?? [];
  const categories = useCategories().data ?? [];
  const mobile = useIsMobile();
  const [dark, toggleDark] = useDark();
  const toast = useToast();
  const { create, patch, remove } = useBookingMutations();

  const [range, setRange] = useState<{ from: Date; to: Date } | null>(null);
  const bookings = useBookings(range?.from ?? null, range?.to ?? null);
  const [hidden, setHidden] = useLocal<number[]>("smsk.hiddenRooms", []);
  const [axis, setAxis] = useLocal<"room" | "category">("smsk.axis", "room");
  const activeRooms = rooms.filter((r) => r.active);
  const shown = (id: number) => !hidden.includes(id);

  const [detail, setDetail] = useState<BookingInstance | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ inst: BookingInstance; scope: EditScope } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [form, setForm] = useState<FormValue | null>(null);
  const [conflicts, setConflicts] = useState<null | ConflictErr["conflicts"]>(null);
  const [force, setForce] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const roomOf = (id: number) => rooms.find((r) => r.id === id);
  const catOf = (id: number) => categories.find((c) => c.id === id);
  const canEdit = (b: BookingInstance) => !!me && (b.mine || isStaff(me));

  const events = useMemo(
    () => (bookings.data ?? []).filter((b) => shown(b.roomId)).map((b) => ({
      id: b.id, title: b.title, start: b.start, end: b.end, editable: canEdit(b), extendedProps: { b },
    })),
    [bookings.data, hidden, me],
  );

  // ---- open editor ----
  const openCreate = (start?: Date, end?: Date) => {
    if (!me) return toast("info", "請先用 LINE 登入才能登記");
    const s = start ?? roundTo(new Date(), 30), e = end ?? addMinutes(s, 60);
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
      if (editor.mode === "create") { await create.mutateAsync(input); toast("ok", "已建立登記"); }
      else {
        const { force: f, rrule, ...fields } = input;
        const patchBody = editor.scope === "this" ? fields : { ...fields, rrule };
        await patch.mutateAsync({ id: editor.inst.seriesId, scope: editor.scope, occurrenceStart: editor.inst.occurrenceStart, patch: patchBody, force: f });
        toast("ok", "已更新");
      }
      closeEditor();
    } catch (e) {
      if (e instanceof ConflictErr) { setConflicts(e.conflicts); setForce(false); }
      else setErr(String((e as Error).message));
    }
  };

  // ---- delete ----
  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      await remove.mutateAsync({ id: confirmDel.inst.seriesId, scope: confirmDel.scope, occurrenceStart: confirmDel.inst.occurrenceStart });
      toast("ok", "已刪除"); setConfirmDel(null); setDetail(null);
    } catch (e) { toast("err", `刪除失敗：${(e as Error).message}`); }
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
      toast("ok", "已移動");
    } catch (er) {
      revert();
      if (er instanceof ConflictErr) toast("err", `衝突：${er.conflicts[0].title} ${fmtRange(new Date(er.conflicts[0].start), new Date(er.conflicts[0].end))}`);
      else toast("err", `移動失敗：${(er as Error).message}`);
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

  const initialView = mobile ? "timeGridThreeDay" : "timeGridWeek";
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="flex items-center gap-2 px-3 py-2.5 md:px-6 md:py-3">
        <h1 className="font-display text-lg font-bold text-primary md:text-xl">石門教會場地登記</h1>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {isAdmin(me) && <Link to="/admin" className="rounded-pill border-2 border-primary px-3 py-1 text-xs font-bold text-primary">管理</Link>}
          <button onClick={toggleDark} aria-label="切換暗色" className="rounded-pill border-2 border-border px-2.5 py-1 text-xs text-muted">{dark ? "亮" : "暗"}</button>
          {me ? (
            <button onClick={logout} className="flex items-center gap-1.5" title="登出">
              {me.image ? <img src={me.image} className="h-8 w-8 rounded-full" alt="" /> : <span className="h-8 w-8 rounded-full bg-teal-soft" />}
              <span className="hidden md:inline">{me.name}</span>
            </button>
          ) : (
            <Button size="sm" onClick={login} className="!bg-[#06C755] !border-[#06C755] !text-white">LINE 登入</Button>
          )}
        </div>
      </header>

      <div className="flex items-center gap-2 px-3 pb-2 md:px-6">
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {activeRooms.map((r) => (
            <Chip key={r.id} on={shown(r.id)} color={roomBg(r.colorToken)} onClick={() => setHidden((h) => (h.includes(r.id) ? h.filter((x) => x !== r.id) : [...h, r.id]))}>{r.name}</Chip>
          ))}
        </div>
        <div className="ml-auto flex-none">
          <Segmented value={axis} onChange={setAxis} options={[{ value: "room", label: "場地" }, { value: "category", label: "類別" }]} />
        </div>
      </div>

      <div className="px-2 pb-24 md:px-6 md:pb-6">
        <Calendar
          key={initialView}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          locale={zhTw}
          initialView={initialView}
          views={{ timeGridThreeDay: { type: "timeGrid", duration: { days: 3 } } }}
          headerToolbar={mobile ? { start: "prev,next", center: "title", end: "today" } : { start: "prev,next today", center: "title", end: "timeGridDay,timeGridWeek,dayGridMonth" }}
          height="auto"
          slotMinTime="06:00:00" slotMaxTime="23:00:00" slotDuration="00:30:00" snapDuration="00:15:00"
          allDaySlot={false} nowIndicator expandRows
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          slotHeaderFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          editable={!!me} selectable={!!me} selectMirror eventResizableFromStart
          eventLongPressDelay={400} selectLongPressDelay={400}
          datesSet={(i: DatesSetInfo) => setRange({ from: i.start, to: i.end })}
          events={events}
          headerToolbarClass="mb-2 flex flex-wrap items-center gap-2"
          toolbarTitleClass="font-display text-base md:text-lg font-bold text-primary"
          buttonClass={(b) => cx("rounded-pill px-3 py-1 text-xs md:text-sm font-semibold border-2 border-primary", b.isSelected ? "bg-primary text-primary-fg" : "text-primary hover:bg-primary/10")}
          buttonGroupClass="flex gap-1"
          viewClass="rounded-lg border-2 border-border bg-surface overflow-hidden"
          dayHeaderClass="py-2 text-center text-xs md:text-sm font-semibold border-b border-border"
          dayHeaderInnerClass={(d) => (d.isToday ? "text-primary underline underline-offset-4" : "")}
          dayCellClass={(d) => cx("border border-border/60", d.isToday && "bg-today")}
          dayLaneClass={(d) => cx("border-l border-border/60", d.isToday && "bg-today")}
          slotLaneClass="border-t border-border/40"
          slotHeaderClass="pr-2 text-[11px] text-muted text-right"
          nowIndicatorLineClass="border-t-2 border-danger"
          nowIndicatorDotClass="bg-danger"
          eventClass={(i) => {
            const b = i.event.extendedProps.b as BookingInstance;
            const bg = axis === "room" ? roomBg(roomOf(b.roomId)?.colorToken ?? "") : catBg(catOf(b.categoryId)?.colorToken ?? "");
            return cx(bg, "group rounded-sm text-white shadow-sm ring-1 ring-black/10 overflow-hidden", (i.isDragging || i.isResizing) && "opacity-70", i.isMirror && "opacity-60");
          }}
          eventInnerClass="pl-2.5 pr-1.5 py-0.5 leading-tight relative"
          /* resize handles (top/bottom edge): 8px hit area, cursor hint, grip visible on hover */
          eventBeforeClass={(i) => cx("absolute inset-x-0 top-0 h-2 z-10", i.isStartResizable && "cursor-ns-resize")}
          eventAfterClass={(i) => cx("absolute inset-x-0 bottom-0 h-2 z-10", i.isEndResizable && "cursor-ns-resize after:absolute after:left-1/2 after:bottom-0.5 after:h-1 after:w-6 after:-translate-x-1/2 after:rounded-full after:bg-white/70 after:opacity-0 group-hover:after:opacity-100")}
          eventContent={(i) => {
            const b = i.event.extendedProps.b as BookingInstance | undefined;
            if (!b) return <div className="text-[11px] px-1">{i.timeText}</div>;
            const stripe = axis === "room" ? catBg(catOf(b.categoryId)?.colorToken ?? "") : roomBg(roomOf(b.roomId)?.colorToken ?? "");
            return (
              <div className="text-[11px] md:text-xs">
                <span className={cx("absolute left-0 top-0 bottom-0 w-1", stripe)} />
                <div className="font-bold truncate">{b.title}{b.recurring ? " ↻" : ""}</div>
                <div className="opacity-90 truncate">{i.timeText} · {axis === "room" ? catOf(b.categoryId)?.name : roomOf(b.roomId)?.name}</div>
                {b.user && <div className="opacity-75 truncate hidden md:block">{b.user.name}</div>}
              </div>
            );
          }}
          eventClick={(i: EventClickInfo) => setDetail(i.event.extendedProps.b)}
          select={(i: DateSelectInfo) => openCreate(i.start, i.end)}
          eventDrop={onDrop}
          eventResize={onResize}
        />
        {bookings.isError && <div className="mt-2 text-sm text-danger">載入失敗，請重新整理。</div>}
      </div>

      {me && (
        <button onClick={() => openCreate()} aria-label="新增登記"
          className="fixed bottom-5 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-3xl text-primary-fg shadow-[0_8px_20px_rgba(46,95,102,.35)] md:bottom-8 md:right-8">＋</button>
      )}

      {/* detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.title}>
        {detail && (() => {
          const s = new Date(detail.start), e = new Date(detail.end);
          const room = roomOf(detail.roomId), cat = catOf(detail.categoryId);
          return (
            <div className="flex flex-col gap-2.5 text-sm">
              <div>{fmtDate(s)} {fmtTime(s)}–{fmtTime(e)}{detail.recurring && <span className="text-muted"> · {describe(fromRRule(detail.rrule), new Date(detail.seriesStart))} ↻</span>}</div>
              <div className="flex gap-2">
                {room && <Chip on color={roomBg(room.colorToken)}>{room.name}</Chip>}
                {cat && <Chip on={false} dot={catBg(cat.colorToken)} className="!text-fg">{cat.name}</Chip>}
              </div>
              <div className="flex items-center gap-2 text-[13px] text-muted">
                {detail.user ? (<>{detail.user.image ? <img src={detail.user.image} className="h-6 w-6 rounded-full" alt="" /> : <span className="h-6 w-6 rounded-full bg-teal-soft" />}{detail.user.name}</>) : "登入後可見登記人"}
              </div>
              {detail.note && <div className="whitespace-pre-wrap text-xs text-muted">備註：{detail.note}</div>}
              {canEdit(detail) ? (
                <div className="mt-2 flex gap-2">
                  <Button className="flex-1" onClick={() => (detail.recurring ? setPending({ kind: "edit", inst: detail }) : openEdit(detail, "all"))}>修改</Button>
                  <Button variant="danger" onClick={() => (detail.recurring ? setPending({ kind: "delete", inst: detail }) : setConfirmDel({ inst: detail, scope: "all" }))}>刪除</Button>
                </div>
              ) : (
                <div className="mt-2 text-center text-xs text-muted">只有登記人本人或幹事可以修改</div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* editor */}
      <Modal open={!!editor && !!form} onClose={closeEditor} title={editor?.mode === "create" ? "新增登記" : editor?.scope === "this" ? "修改這一次" : editor?.scope === "following" ? "修改此後" : "修改登記"}>
        {editor && form && (
          <BookingForm value={form} onChange={setForm} rooms={rooms} categories={categories}
            conflicts={conflicts} canForce={isStaff(me)} force={force} onForce={setForce}
            allowRepeat={editor.mode === "create" || editor.scope !== "this"}
            submitLabel={editor.mode === "create" ? "儲存登記" : "儲存修改"} busy={create.isPending || patch.isPending}
            onSubmit={submit} onCancel={closeEditor} error={err} />
        )}
      </Modal>

      <ScopeDialog open={!!pending} onClose={cancelPending} onPick={pickScope}
        verb={pending?.kind === "delete" ? "刪除" : "修改"} title={pending?.inst.title ?? ""}
        occurrenceLabel={pending ? fmtDate(new Date(pending.inst.start)) : ""} />
      <ConfirmDelete open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={doDelete} busy={remove.isPending}
        summary={confirmDel ? `${confirmDel.inst.title} · ${fmtRange(new Date(confirmDel.inst.start), new Date(confirmDel.inst.end))} · ${roomOf(confirmDel.inst.roomId)?.name ?? ""}${confirmDel.scope === "all" && confirmDel.inst.recurring ? "（整個系列）" : confirmDel.scope === "following" ? "（此後全部）" : ""}` : ""} />
    </div>
  );
}
