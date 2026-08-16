// ponytail: 自寫中文日期/時間選擇器（給長者：大按鈕、不靠鍵盤/滾輪、不受手機語系影響）。
// 取代 <input type=date/time>。要更多（範圍、多月）再考慮 react-day-picker。
import { useState } from "react";
import { Button, Chip, Icon, Modal, cx } from "../ui";
import { dateInput } from "../lib/time";

const DOW = ["日", "一", "二", "三", "四", "五", "六"];
const pad = (n: number) => String(n).padStart(2, "0");
const parseDate = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06–23
const MINUTES = [0, 15, 30, 45];

const fieldCls = "flex w-full min-h-[52px] items-center justify-between gap-2 rounded-md border-2 bg-surface px-3.5 py-2.5 text-left text-lg font-bold text-fg tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** value: "YYYY-MM-DD" (local) */
export function DateField({ value, onChange, min, label = "選日期" }: { value: string; onChange: (v: string) => void; min?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const sel = parseDate(value);
  const [cursor, setCursor] = useState(() => new Date(sel.getFullYear(), sel.getMonth(), 1));
  const today = dateInput(new Date());
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const cells: (Date | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate() }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))];
  const pick = (d: Date) => { onChange(dateInput(d)); setOpen(false); };
  const openAt = () => { setCursor(new Date(sel.getFullYear(), sel.getMonth(), 1)); setOpen(true); };
  return (
    <>
      <button type="button" onClick={openAt} className={cx(fieldCls, "border-border")}>
        <span>{sel.getFullYear()}年{sel.getMonth() + 1}月{sel.getDate()}日<span className="ml-1 text-base font-normal text-muted">（週{DOW[sel.getDay()]}）</span></span>
        <Icon name="calendar" size={22} className="text-primary" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={label} icon="calendar">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="上個月"><Icon name="chevron-left" size={20} />上個月</Button>
          <div className="font-display text-xl font-bold text-primary">{cursor.getFullYear()}年{cursor.getMonth() + 1}月</div>
          <Button size="sm" variant="ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="下個月">下個月<Icon name="chevron-right" size={20} /></Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {DOW.map((d, i) => <div key={d} className={cx("py-1 text-sm font-bold", i === 0 ? "text-danger" : "text-muted")}>{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const v = dateInput(d), isSel = v === value, isToday = v === today, disabled = !!min && v < min;
            return (
              <button key={v} type="button" disabled={disabled} onClick={() => pick(d)} aria-label={`${d.getMonth() + 1}月${d.getDate()}日`} aria-pressed={isSel}
                className={cx("flex h-12 items-center justify-center rounded-md text-lg font-bold tabular-nums focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30",
                  isSel ? "bg-primary text-primary-fg" : isToday ? "bg-today text-primary ring-2 ring-primary/40" : "hover:bg-primary/10", !isSel && d.getDay() === 0 && "text-danger")}>{d.getDate()}</button>
            );
          })}
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>取消</Button>
          <Button variant="plain" className="flex-1" onClick={() => pick(new Date())}>今天</Button>
        </div>
      </Modal>
    </>
  );
}

/** value: "HH:mm" (24h) */
/** min: "HH:mm" — 結束時間用；早於或等於 min 的時/分會灰掉不能選 */
export function TimeField({ value, onChange, label = "選時間", err, min }: { value: string; onChange: (v: string) => void; label?: string; err?: boolean; min?: string }) {
  const [open, setOpen] = useState(false);
  const [h, m] = value.split(":").map(Number);
  const [minH, minM] = min ? min.split(":").map(Number) : [-1, -1];
  const hourOk = (x: number) => x > minH || (x === minH && MINUTES.some((y) => y > minM));
  const minuteOk = (hx: number, y: number) => hx > minH || (hx === minH && y > minM);
  const [hh, setHh] = useState(h);
  const [mm, setMm] = useState(m);
  const openAt = () => { setHh(h); setMm(m); setOpen(true); };
  const pickH = (x: number) => { setHh(x); if (!minuteOk(x, mm)) setMm(MINUTES.find((y) => minuteOk(x, y)) ?? 0); };
  const valid = hourOk(hh) && minuteOk(hh, mm);
  const ok = () => { onChange(`${pad(hh)}:${pad(hh === 23 ? 0 : mm)}`); setOpen(false); }; // 日曆只到 23:00
  const ampm = (x: number) => (x < 12 ? "上午" : x < 18 ? "下午" : "晚上");
  return (
    <>
      <button type="button" onClick={openAt} aria-invalid={err || undefined} className={cx(fieldCls, err ? "border-danger" : "border-border")}>
        <span>{pad(h)}:{pad(m)}<span className="ml-1.5 text-base font-normal text-muted">{ampm(h)}</span></span>
        <Icon name="clock" size={22} className="text-primary" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={label} icon="clock">
        <div className="mb-3 rounded-md bg-today px-4 py-3 text-center font-display text-3xl font-bold tabular-nums text-primary">{pad(hh)}:{pad(hh === 23 ? 0 : mm)}<span className="ml-2 text-lg font-normal text-muted">{ampm(hh)}</span></div>
        {min && <div className="mb-2 text-sm text-muted">要比開始時間（{min}）晚</div>}
        <div className="text-sm font-bold text-muted">幾點</div>
        <div className="mt-1.5 grid grid-cols-6 gap-1.5">
          {HOURS.map((x) => (
            <button key={x} type="button" onClick={() => pickH(x)} aria-pressed={x === hh} disabled={!hourOk(x)}
              className={cx("flex h-12 items-center justify-center rounded-md border-2 text-lg font-bold tabular-nums focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30 disabled:cursor-not-allowed", x === hh ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface hover:bg-primary/10")}>{x}</button>
          ))}
        </div>
        <div className="mt-4 text-sm font-bold text-muted">幾分</div>
        <div className="mt-1.5 grid grid-cols-4 gap-2">
          {MINUTES.map((x) => { const off = (hh === 23 && x > 0) || !minuteOk(hh, x); return <Chip key={x} on={x === (hh === 23 ? 0 : mm)} onClick={() => !off && setMm(x)} className={cx("justify-center tabular-nums", off && "opacity-30 cursor-not-allowed")}>{pad(x)} 分</Chip>; })}
        </div>
        <div className="mt-5 flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>取消</Button>
          <Button className="flex-[2]" icon="check" onClick={ok} disabled={!valid}>確定</Button>
        </div>
      </Modal>
    </>
  );
}
