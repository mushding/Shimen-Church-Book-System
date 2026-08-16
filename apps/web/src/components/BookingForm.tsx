import { useMemo, useState } from "react";
import type { BookingInput, Category, Conflict, Room } from "@smsk/shared";
import { Button, Chip, Field, Input, cssColor, cx } from "../ui";
import { RepeatEditor } from "./RepeatEditor";
import { describe, fromRRule, toRRule, type Repeat } from "../lib/recur";
import { dateInput, fmtShort, fromInputs, timeInput } from "../lib/time";

export type FormValue = { title: string; note: string; roomId: number | null; categoryId: number | null; date: string; startTime: string; endTime: string; repeat: Repeat };

export function initialForm(o: { start: Date; end: Date; roomId?: number | null; categoryId?: number | null; title?: string; note?: string; rrule?: string | null }): FormValue {
  return { title: o.title ?? "", note: o.note ?? "", roomId: o.roomId ?? null, categoryId: o.categoryId ?? null, date: dateInput(o.start), startTime: timeInput(o.start), endTime: timeInput(o.end), repeat: fromRRule(o.rrule ?? null) };
}

export function toInput(v: FormValue, force: boolean): BookingInput | string {
  if (!v.title.trim()) return "請填登記目的";
  if (!v.roomId) return "請選場地";
  if (!v.categoryId) return "請選類別";
  const start = fromInputs(v.date, v.startTime), end = fromInputs(v.date, v.endTime);
  if (!(end > start)) return "結束時間要晚於開始";
  return { title: v.title.trim(), note: v.note, roomId: v.roomId, categoryId: v.categoryId, start: start.toISOString(), end: end.toISOString(), rrule: toRRule(v.repeat, start), force };
}

export function BookingForm({ value, onChange, rooms, categories, conflicts, canForce, force, onForce, allowRepeat = true, submitLabel, onSubmit, onCancel, busy, error }: {
  value: FormValue; onChange: (v: FormValue) => void; rooms: Room[]; categories: Category[];
  conflicts: Conflict[] | null; canForce: boolean; force: boolean; onForce: (b: boolean) => void; allowRepeat?: boolean;
  submitLabel: string; onSubmit: () => void; onCancel: () => void; busy?: boolean; error?: string | null;
}) {
  const [repeatOpen, setRepeatOpen] = useState(false);
  const dtstart = useMemo(() => fromInputs(value.date, value.startTime), [value.date, value.startTime]);
  const set = <K extends keyof FormValue>(k: K, x: FormValue[K]) => onChange({ ...value, [k]: x });
  const roomName = (id: number) => rooms.find((r) => r.id === id)?.name ?? "";
  if (repeatOpen)
    return <RepeatEditor value={value.repeat} dtstart={dtstart} onBack={() => setRepeatOpen(false)} onApply={(r) => { set("repeat", r); setRepeatOpen(false); }} />;
  const conflictRoom = conflicts?.length ? conflicts[0].roomId : null;
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      {conflicts && conflicts.length > 0 && (
        <div className="rounded-md border-2 border-danger bg-surface px-3.5 py-3 text-[13px] leading-relaxed">
          <b className="text-danger">{roomName(conflicts[0].roomId)} 已有登記</b>
          {conflicts.slice(0, 4).map((c, i) => <div key={i}>{c.title} · {fmtShort(new Date(c.start))}–{new Date(c.end).toTimeString().slice(0, 5)}</div>)}
          {conflicts.length > 4 && <div className="text-muted">…還有 {conflicts.length - 4} 筆</div>}
          <div className="text-muted">請改時間或場地。</div>
        </div>
      )}
      <Field label="登記目的"><Input value={value.title} maxLength={60} autoFocus onChange={(e) => set("title", e.target.value)} placeholder="例：青少契劇會排練" /></Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-primary">場地</span>
        <div className="flex flex-wrap gap-1.5">
          {rooms.filter((r) => r.active || r.id === value.roomId).map((r) => (
            <Chip key={r.id} on={value.roomId === r.id} color={cssColor(r.colorToken)} onClick={() => set("roomId", r.id)}
              className={cx(conflictRoom === r.id && value.roomId === r.id && "outline outline-2 outline-offset-2 outline-danger")}>{r.name}{value.roomId === r.id ? " ✓" : ""}</Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-primary">類別</span>
        <div className="flex flex-wrap gap-1.5">
          {categories.filter((c) => c.active || c.id === value.categoryId).map((c) => (
            <Chip key={c.id} on={value.categoryId === c.id} dot={cssColor(c.colorToken)} onClick={() => set("categoryId", c.id)}
              className={cx(value.categoryId === c.id && "!bg-transparent !text-fg !border-primary")}>{c.name}</Chip>
          ))}
        </div>
      </div>
      <Field label="日期"><Input type="date" value={value.date} onChange={(e) => set("date", e.target.value)} /></Field>
      <div className="flex gap-2">
        <Field label="開始"><Input type="time" step={900} value={value.startTime} err={!!conflicts?.length} onChange={(e) => set("startTime", e.target.value)} /></Field>
        <Field label="結束"><Input type="time" step={900} value={value.endTime} err={!!conflicts?.length} onChange={(e) => set("endTime", e.target.value)} /></Field>
      </div>
      {allowRepeat && (
        <button type="button" onClick={() => setRepeatOpen(true)} className="flex items-center justify-between rounded-md px-0.5 py-1.5 text-left">
          <span className="text-[13px] font-bold text-primary">重複</span>
          <span className="text-sm">{describe(value.repeat, dtstart)} <span className="text-muted">›</span></span>
        </button>
      )}
      <Field label="備註（選填）"><Input value={value.note} maxLength={2000} onChange={(e) => set("note", e.target.value)} placeholder="例：需要投影機" /></Field>
      {conflicts && conflicts.length > 0 && canForce && (
        <label className="flex items-start gap-3 rounded-md border-2 border-border bg-surface px-3.5 py-3">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-primary" checked={force} onChange={(e) => onForce(e.target.checked)} />
          <span className="text-[13px] leading-relaxed"><b>強制建立（幹事）</b><br /><span className="text-muted">忽略衝突，兩筆登記並存。</span></span>
        </label>
      )}
      {error && <div className="text-sm text-danger">{error}</div>}
      <div className="mt-2 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>取消</Button>
        <Button type="submit" className="flex-[2]" disabled={busy || (!!conflicts?.length && !force)}>{submitLabel}</Button>
      </div>
    </form>
  );
}
