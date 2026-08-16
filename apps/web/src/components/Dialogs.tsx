import { useState } from "react";
import type { EditScope } from "@smsk/shared";
import { Button, Icon, Modal, Option } from "../ui";

export function ScopeDialog({ open, title, verb, occurrenceLabel, onPick, onClose }: { open: boolean; title: string; verb: "修改" | "刪除"; occurrenceLabel: string; onPick: (s: EditScope) => void; onClose: () => void }) {
  const [s, setS] = useState<EditScope>("this");
  return (
    <Modal open={open} onClose={onClose} title={`${verb}重複的登記`} icon="repeat">
      <div className="text-base leading-relaxed">「{title}」是每次都會重複的登記。<br />您想{verb}哪些？</div>
      <div role="radiogroup" className="mt-4 flex flex-col gap-2">
        <Option on={s === "this"} onClick={() => setS("this")} title="只有這一次" note={`只動 ${occurrenceLabel} 這一筆，其他照舊`} />
        <Option on={s === "following"} onClick={() => setS("following")} title="這一次和之後的" note={`${occurrenceLabel} 起全部；之前的保留`} />
        <Option on={s === "all"} onClick={() => setS("all")} title="全部" note="整個系列一起" />
      </div>
      <div className="mt-5 flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onClose}>取消</Button>
        <Button className="flex-[2]" icon="check" onClick={() => onPick(s)}>下一步</Button>
      </div>
    </Modal>
  );
}

export function ConfirmDelete({ open, summary, onConfirm, onClose, busy }: { open: boolean; summary: string; onConfirm: () => void; onClose: () => void; busy?: boolean }) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex items-center gap-2 font-display text-2xl font-bold text-danger"><Icon name="trash" size={24} />確定要刪除嗎？</div>
      <div className="mt-3 rounded-md bg-bg px-3.5 py-2.5 text-base leading-relaxed">{summary}</div>
      <div className="mt-2 text-sm text-muted">刪除後無法復原。</div>
      <div className="mt-5 flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onClose}>取消</Button>
        <Button variant="danger-solid" className="flex-1" icon="trash" disabled={busy} onClick={onConfirm}>{busy ? "刪除中…" : "確定刪除"}</Button>
      </div>
    </Modal>
  );
}
