const pad = (n: number) => String(n).padStart(2, "0");
/** Date → "YYYY-MM-DD" (local) */
export const dateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Date → "HH:mm" (local) */
export const timeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** "YYYY-MM-DD" + "HH:mm" → Date (local) */
export const fromInputs = (date: string, time: string) => new Date(`${date}T${time}:00`);
export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
export const roundTo = (d: Date, minutes: number) => new Date(Math.round(d.getTime() / (minutes * 60_000)) * minutes * 60_000);

const DOW = ["日", "一", "二", "三", "四", "五", "六"];
export const fmtDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}（${DOW[d.getDay()]}）`;
export const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const fmtRange = (s: Date, e: Date) =>
  dateInput(s) === dateInput(e) ? `${fmtDate(s)} ${fmtTime(s)}–${fmtTime(e)}` : `${fmtDate(s)} ${fmtTime(s)} – ${fmtDate(e)} ${fmtTime(e)}`;
export const fmtShort = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} ${fmtTime(d)}`;
