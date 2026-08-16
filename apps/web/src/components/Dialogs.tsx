import { useState } from "react";
import type { EditScope } from "@smsk/shared";
import { Button, Modal, Option } from "../ui";

export function ScopeDialog({ open, title, verb, occurrenceLabel, onPick, onClose }: { open: boolean; title: string; verb: "修改" | "刪除"; occurrenceLabel: string; onPick: (s: EditScope) => void; onClose: () => void }) {
  const [s, setS] = useState<EditScope>("this");
  return (
    <Modal open={open} onClose={onClose} title={`${verb}重複登記`}>
      <div className="text-xs text-muted">「{title}」是重複登記。要{verb}哪些？</div>
      <div className="mt-3 flex flex-col gap-2">
        <Option on={s === "this"} onClick={() => setS("this")} title="只有這一次" note={`${occurrenceLabel} 這筆，其餘不動`} />
        <Option on={s === "following"} onClick={() => setS("following")} title="這一次和之後" note={`${occurrenceLabel} 起全部；之前的保留`} />
        <Option on={s === "all"} onClick={() => setS("all")} title="全部" note="整個系列一起" />
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" size="sm" className="flex-1" onClick={onClose}>取消</Button>
        <Button size="sm" className="flex-[2]" onClick={() => onPick(s)}>確認</Button>
      </div>
    </Modal>
  );
}

export function ConfirmDelete({ open, summary, onConfirm, onClose, busy }: { open: boolean; summary: string; onConfirm: () => void; onClose: () => void; busy?: boolean }) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="font-display text-lg font-bold text-danger">刪除這筆登記？</div>
      <div className="mt-1.5 text-xs text-muted">{summary}<br />刪除後無法復原。</div>
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" size="sm" className="flex-1" onClick={onClose}>取消</Button>
        <Button variant="danger-solid" size="sm" className="flex-1" disabled={busy} onClick={onConfirm}>刪除</Button>
      </div>
    </Modal>
  );
}
