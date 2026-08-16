import { useState } from "react";
import { Button, Chip, Input, Option, Segmented } from "../ui";
import { describe, preview, type Repeat } from "../lib/recur";
import { dateInput, fmtDate } from "../lib/time";
import { DateField } from "./Pickers";

const DOWS = ["日", "一", "二", "三", "四", "五", "六"];
type Freq = Repeat["freq"];

export function RepeatEditor({ value, dtstart, onApply, onBack }: { value: Repeat; dtstart: Date; onApply: (r: Repeat) => void; onBack: () => void }) {
  const [r, setR] = useState<Repeat>(value);
  const setFreq = (f: Freq) =>
    setR(f === "none" ? { freq: "none" } : { freq: f, interval: 1, byday: f === "weekly" ? [dtstart.getDay()] : [], end: r.freq === "none" ? { kind: "never" } : r.end });
  const pv = preview(r, dtstart);
  return (
    <div className="flex flex-col gap-4">
      <div className="font-display text-xl font-bold text-primary">設定重複</div>
      <Segmented size="sm" label="重複頻率" value={r.freq} onChange={setFreq} options={[{ value: "none", label: "不重複" }, { value: "daily", label: "每天" }, { value: "weekly", label: "每週" }, { value: "monthly", label: "每月" }]} />
      {r.freq !== "none" && (
        <>
          <label className="flex items-center gap-2 text-base">每 <Input type="number" min={1} max={12} className="!w-24" value={r.interval} onChange={(e) => setR({ ...r, interval: Math.max(1, Number(e.target.value) || 1) })} /> {r.freq === "daily" ? "天" : r.freq === "weekly" ? "週" : "月"}</label>
          {r.freq === "weekly" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-base font-bold text-primary">每週的哪幾天</span>
              <div className="flex flex-wrap gap-2">
                {DOWS.map((d, i) => (
                  <Chip key={i} on={r.byday.includes(i)} onClick={() => setR({ ...r, byday: r.byday.includes(i) ? r.byday.filter((x) => x !== i) : [...r.byday, i] })}>{d}</Chip>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <span className="text-base font-bold text-primary">什麼時候結束</span>
            <Option on={r.end.kind === "until"} onClick={() => setR({ ...r, end: { kind: "until", date: r.end.kind === "until" ? r.end.date : dateInput(new Date(dtstart.getTime() + 90 * 86400_000)) } })}
              title="到某一天為止" note={r.end.kind === "until" ? "在下面選最後一天" : undefined} />
            {r.end.kind === "until" && <div className="ml-9 max-w-[300px]"><DateField value={r.end.date} min={dateInput(dtstart)} label="選最後一天" onChange={(v) => setR({ ...r, end: { kind: "until", date: v } })} /></div>}
            <Option on={r.end.kind === "count"} onClick={() => setR({ ...r, end: { kind: "count", n: r.end.kind === "count" ? r.end.n : 12 } })}
              title={<span className="flex items-center gap-2">重複 {r.end.kind === "count" ? <Input type="number" min={1} max={200} className="!w-24 !min-h-[40px]" value={r.end.n} onClick={(e) => e.stopPropagation()} onChange={(e) => setR({ ...r, end: { kind: "count", n: Math.max(1, Number(e.target.value) || 1) } })} /> : "N"} 次後結束</span>} />
            <Option on={r.end.kind === "never"} onClick={() => setR({ ...r, end: { kind: "never" } })} title="一直重複，不設結束" />
          </div>
        </>
      )}
      <div className="rounded-md bg-today px-3.5 py-2.5 text-base leading-relaxed"><b>{describe(r, dtstart)}</b>{r.freq !== "none" && <> <br /><span className="text-sm text-muted">預覽：{pv.dates.map((d) => fmtDate(d).replace(/（.*）/, "")).join("、")}{pv.total ? ` … 共 ${pv.total} 次` : " …"}</span></>}</div>
      <div className="mt-2 flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onBack}>返回</Button>
        <Button className="flex-[2]" icon="check" onClick={() => onApply(r)}>確定</Button>
      </div>
    </div>
  );
}
