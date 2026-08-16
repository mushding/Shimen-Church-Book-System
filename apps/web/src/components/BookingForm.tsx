import { useEffect, useMemo, useRef, useState } from "react";
import type { BookingInput, Category, Conflict, Room } from "@smsk/shared";
import { Button, Chip, Field, Icon, Input, cssColor, cx } from "../ui";
import { RepeatEditor } from "./RepeatEditor";
import { describe, fromRRule, toRRule, type Repeat } from "../lib/recur";
import { addMinutes, dateInput, fmtDate, fmtShort, fmtTime, fromInputs, timeInput } from "../lib/time";

export type FormValue = { title: string; note: string; roomId: number | null; categoryId: number | null; date: string; startTime: string; endTime: string; repeat: Repeat };

export function initialForm(o: { start: Date; end: Date; roomId?: number | null; categoryId?: number | null; title?: string; note?: string; rrule?: string | null }): FormValue {
  return { title: o.title ?? "", note: o.note ?? "", roomId: o.roomId ?? null, categoryId: o.categoryId ?? null, date: dateInput(o.start), startTime: timeInput(o.start), endTime: timeInput(o.end), repeat: fromRRule(o.rrule ?? null) };
}

export function toInput(v: FormValue, force: boolean): BookingInput | string {
  if (!v.title.trim()) return "請填寫活動名稱";
  if (!v.roomId) return "請選一個場地";
  if (!v.categoryId) return "請選一個類別";
  const start = fromInputs(v.date, v.startTime), end = fromInputs(v.date, v.endTime);
  if (!(end > start)) return "結束時間要比開始時間晚";
  return { title: v.title.trim(), note: v.note, roomId: v.roomId, categoryId: v.categoryId, start: start.toISOString(), end: end.toISOString(), rrule: toRRule(v.repeat, start), force };
}

const DURATIONS = [{ m: 60, label: "1 小時" }, { m: 90, label: "1.5 小時" }, { m: 120, label: "2 小時" }, { m: 180, label: "3 小時" }];

export function BookingForm({ value, onChange, rooms, categories, conflicts, canForce, force, onForce, allowRepeat = true, submitLabel, onSubmit, onCancel, busy, error }: {
  value: FormValue; onChange: (v: FormValue) => void; rooms: Room[]; categories: Category[];
  conflicts: Conflict[] | null; canForce: boolean; force: boolean; onForce: (b: boolean) => void; allowRepeat?: boolean;
  submitLabel: string; onSubmit: () => void; onCancel: () => void; busy?: boolean; error?: string | null;
}) {
  const [repeatOpen, setRepeatOpen] = useState(false);
  // progressive disclosure（長者一次只看一件事）：名稱 → 場地 → 類別 → 其餘。已揭露的段落不再收回。
  const stageNow = !value.title.trim() ? 0 : !value.roomId ? 1 : !value.categoryId ? 2 : 3;
  const [stage, setStage] = useState(stageNow);
  useEffect(() => { if (stageNow > stage) setStage(stageNow); }, [stageNow, stage]);
  const lastRef = useRef<HTMLDivElement>(null);
  useEffect(() => { lastRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [stage]);
  const dtstart = useMemo(() => fromInputs(value.date, value.startTime), [value.date, value.startTime]);
  const dtend = useMemo(() => fromInputs(value.date, value.endTime), [value.date, value.endTime]);
  const durationMin = Math.round((dtend.getTime() - dtstart.getTime()) / 60_000);
  const set = <K extends keyof FormValue>(k: K, x: FormValue[K]) => onChange({ ...value, [k]: x });
  // single-date form: end must stay on the same day → clamp at 23:59; chips that would cross midnight are disabled
  const fits = (m: number) => addMinutes(dtstart, m).getDate() === dtstart.getDate();
  const setDuration = (m: number) => onChange({ ...value, endTime: fits(m) ? timeInput(addMinutes(dtstart, m)) : "23:59" });
  const roomName = (id: number) => rooms.find((r) => r.id === id)?.name ?? "";
  if (repeatOpen)
    return <RepeatEditor value={value.repeat} dtstart={dtstart} onBack={() => setRepeatOpen(false)} onApply={(r) => { set("repeat", r); setRepeatOpen(false); }} />;
  const conflictRoom = conflicts?.length ? conflicts[0].roomId : null;
  const timeBad = durationMin <= 0;
  const durationText = timeBad ? "" : durationMin % 60 === 0 ? `${durationMin / 60} 小時` : durationMin > 60 ? `${Math.floor(durationMin / 60)} 小時 ${durationMin % 60} 分` : `${durationMin} 分鐘`;
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate>
      {conflicts && conflicts.length > 0 && (
        <div role="alert" className="flex gap-3 rounded-md border-2 border-danger bg-surface px-4 py-3 text-base leading-relaxed">
          <Icon name="alert" size={24} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <b className="text-danger">這個時段「{roomName(conflicts[0].roomId)}」已經有人登記了</b>
            {conflicts.slice(0, 4).map((c, i) => <div key={i} className="text-sm">・{c.title}：{fmtShort(new Date(c.start))}–{fmtTime(new Date(c.end))}</div>)}
            {conflicts.length > 4 && <div className="text-sm text-muted">…還有 {conflicts.length - 4} 筆</div>}
            <div className="mt-1 text-sm text-muted">請改一下時間，或換一個場地。</div>
          </div>
        </div>
      )}
      <Field label="活動名稱" required><Input value={value.title} maxLength={60} autoFocus onChange={(e) => set("title", e.target.value)} placeholder="例：青少契劇會排練、姊妹會" /></Field>
      {stage >= 1 && <div ref={stage === 1 ? lastRef : undefined} className="flex flex-col gap-1.5">
        <span className="text-base font-bold text-primary">場地<span className="ml-1 text-danger" aria-hidden="true">＊</span></span>
        <div role="radiogroup" aria-label="場地" className="flex flex-wrap gap-2">
          {rooms.filter((r) => r.active || r.id === value.roomId).map((r) => (
            <Chip key={r.id} check on={value.roomId === r.id} color={cssColor(r.colorToken)} onClick={() => set("roomId", r.id)}
              className={cx(conflictRoom === r.id && value.roomId === r.id && "outline outline-2 outline-offset-2 outline-danger")}>{r.name}</Chip>
          ))}
        </div>
      </div>}
      {stage >= 2 && <div ref={stage === 2 ? lastRef : undefined} className="flex flex-col gap-1.5">
        <span className="text-base font-bold text-primary">類別<span className="ml-1 text-danger" aria-hidden="true">＊</span></span>
        <div role="radiogroup" aria-label="類別" className="flex flex-wrap gap-2">
          {categories.filter((c) => c.active || c.id === value.categoryId).map((c) => (
            <Chip key={c.id} check on={value.categoryId === c.id} dot={cssColor(c.colorToken)} onClick={() => set("categoryId", c.id)}
              className={cx(value.categoryId === c.id && "!bg-today !text-fg !border-primary")}>{c.name}</Chip>
          ))}
        </div>
      </div>}
      {stage >= 3 && <div ref={lastRef} className="flex flex-col gap-4">
      <Field label="日期" required><Input type="date" value={value.date} onChange={(e) => set("date", e.target.value)} /></Field>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="開始時間" required><Input type="time" step={900} value={value.startTime} err={!!conflicts?.length || timeBad} onChange={(e) => set("startTime", e.target.value)} /></Field>
          <Field label="結束時間" required><Input type="time" step={900} value={value.endTime} err={!!conflicts?.length || timeBad} onChange={(e) => set("endTime", e.target.value)} /></Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">用多久：</span>
          {DURATIONS.map((d) => <Chip key={d.m} size="sm" on={durationMin === d.m} onClick={() => setDuration(d.m)} className={cx(!fits(d.m) && "opacity-40")}>{d.label}</Chip>)}
        </div>
        <div className={cx("rounded-md px-3.5 py-2 text-base", timeBad ? "bg-danger/10 text-danger" : "bg-today text-fg")}>
          {timeBad ? "結束時間要比開始時間晚（登記不能跨過午夜，請分成兩筆）" : <><b>{fmtDate(dtstart)}</b> {fmtTime(dtstart)}–{fmtTime(dtend)}<span className="text-muted">（{durationText}）</span></>}
        </div>
      </div>
      {allowRepeat && (
        <button type="button" onClick={() => setRepeatOpen(true)} className="flex min-h-[52px] items-center justify-between gap-3 rounded-md border-2 border-border bg-surface px-4 py-2.5 text-left hover:bg-primary/5">
          <span className="flex items-center gap-2 text-base font-bold text-primary"><Icon name="repeat" size={20} />重複</span>
          <span className="flex items-center gap-1 text-base">{describe(value.repeat, dtstart)}<Icon name="chevron-right" size={20} className="text-muted" /></span>
        </button>
      )}
      <Field label="備註（可不填）"><Input value={value.note} maxLength={2000} onChange={(e) => set("note", e.target.value)} placeholder="例：需要投影機、需開冷氣" /></Field>
      {conflicts && conflicts.length > 0 && canForce && (
        <label className="flex items-start gap-3 rounded-md border-2 border-border bg-surface px-4 py-3">
          <input type="checkbox" className="mt-1 h-6 w-6 accent-primary" checked={force} onChange={(e) => onForce(e.target.checked)} />
          <span className="text-base leading-relaxed"><b>仍要登記（幹事權限）</b><br /><span className="text-sm text-muted">忽略衝突，兩筆登記同時存在。</span></span>
        </label>
      )}
      </div>}
      {error && <div role="alert" className="flex items-center gap-2 rounded-md bg-danger/10 px-3.5 py-2.5 text-base font-bold text-danger"><Icon name="alert" size={20} />{error}</div>}
      <div className="mt-1 flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>取消</Button>
        {stage >= 3 ? (
          <Button type="submit" className="flex-[2]" icon="check" disabled={busy || (!!conflicts?.length && !force)}>{busy ? "儲存中…" : submitLabel}</Button>
        ) : (
          <div className="flex flex-[2] items-center justify-center text-sm text-muted">{stage === 0 ? "先填活動名稱" : stage === 1 ? "再選一個場地" : "再選一個類別"}</div>
        )}
      </div>
    </form>
  );
}
