import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Category, Role, Room } from "@smsk/shared";
import { api, isAdmin, useCategories, useMe, useRooms } from "../api";
import { Button, Input, Modal, Segmented, cx, toHex, useToast } from "../ui";

type AdminUser = { id: string; name: string; image: string | null; role: Role | null; createdAt: string };
const j = async <T,>(p: Promise<Response>): Promise<T> => {
  const r = await p;
  if (r.status === 409) throw new Error("in_use");
  if (!r.ok) throw new Error(`${r.status}`);
  return r.status === 204 ? (undefined as T) : r.json();
};

export function AdminPage() {
  const me = useMe();
  if (me.isLoading) return null;
  if (!isAdmin(me.data ?? null)) return <div className="p-6 text-sm">需要 admin 權限。<Link to="/" className="text-primary underline">回行事曆</Link></div>;
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="flex items-center gap-3 px-3 py-3 md:px-6">
        <Link to="/" className="text-sm text-primary">‹ 行事曆</Link>
        <h1 className="font-display text-lg font-bold text-primary md:text-xl">管理後台</h1>
      </header>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-3 pb-10 md:px-6">
        <Rooms /><Categories /><Users />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flex flex-col gap-3"><h2 className="font-display text-base font-bold text-primary">{title}</h2>{children}</section>;
}
function Toggle({ on, onChange, label }: { on: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cx("relative box-border block h-[26px] w-11 shrink-0 rounded-full p-[3px] align-middle outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50", on ? "bg-primary" : "bg-border")}>
      <span className={cx("block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out", on ? "translate-x-[18px]" : "translate-x-0")} />
    </button>
  );
}
/** Native colour picker; shows the resolved swatch (token → hex) and emits hex. */
function ColorPicker({ token, onChange, label }: { token: string; onChange: (hex: string) => void; label: string }) {
  const [hex, setHex] = useState("#888888");
  useEffect(() => { setHex(toHex(token)); }, [token]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pick = (v: string) => { setHex(v); clearTimeout(timer.current); timer.current = setTimeout(() => onChange(v), 400); }; // picker fires per drag tick → debounce PATCH
  return (
    <label className="relative block h-8 w-12 cursor-pointer overflow-hidden rounded-sm ring-1 ring-black/10" style={{ background: hex }} title={label}>
      <input type="color" aria-label={label} value={hex} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={(e) => pick(e.target.value)} />
    </label>
  );
}

/** Generic sortable table: HTML5 drag & drop on rows → PATCH sort for the changed ones. Extra columns via `cols`. */
type Base = { id: number; name: string; colorToken: string; sort: number; active: boolean };
function EntityTable<T extends Base>({ items, cols, onPatch, onDelete, addLabel, onAdd, hint }: {
  items: T[]; cols: { head: string; cell: (t: T) => ReactNode }[];
  onPatch: (id: number, patch: Partial<T>) => Promise<unknown>; onDelete: (t: T) => Promise<unknown>;
  addLabel: string; onAdd: (name: string) => Promise<unknown>; hint?: string;
}) {
  const toast = useToast();
  const sorted = useMemo(() => [...items].sort((a, b) => a.sort - b.sort || a.id - b.id), [items]);
  const [order, setOrder] = useState<number[]>([]);
  useEffect(() => { setOrder(sorted.map((x) => x.id)); }, [sorted]);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [del, setDel] = useState<T | null>(null);
  const rows = order.map((id) => sorted.find((x) => x.id === id)!).filter(Boolean);

  const drop = async () => {
    if (drag === null || over === null || drag === over) return void (setDrag(null), setOver(null));
    const next = order.filter((id) => id !== drag);
    next.splice(next.indexOf(over) + (order.indexOf(drag) < order.indexOf(over) ? 1 : 0), 0, drag);
    setOrder(next); setDrag(null); setOver(null);
    // ponytail: PATCH every row whose position changed; N ≤ ~15 so fine
    await Promise.all(next.map((id, i) => (sorted.find((x) => x.id === id)!.sort !== i ? onPatch(id, { sort: i } as Partial<T>) : null)));
  };
  return (
    <>
      <div className="overflow-x-auto rounded-lg border-2 border-border bg-surface">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted">{["", "顏色", "名稱", ...cols.map((c) => c.head), "啟用", ""].map((h, i) => <th key={i} className="border-b-2 border-border px-3 py-2.5 font-bold">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} draggable onDragStart={() => setDrag(r.id)} onDragOver={(e) => { e.preventDefault(); setOver(r.id); }} onDrop={drop} onDragEnd={() => { setDrag(null); setOver(null); }}
                className={cx("border-b border-border transition-colors", !r.active && "opacity-50", drag === r.id && "opacity-40", over === r.id && drag !== null && drag !== r.id && "bg-today")}>
                <td className="w-8 cursor-grab select-none px-2 text-center text-muted active:cursor-grabbing" title="拖曳排序">⋮⋮</td>
                <td className="px-3 py-2"><ColorPicker token={r.colorToken} label={`${r.name} 顏色`} onChange={(hex) => onPatch(r.id, { colorToken: hex } as Partial<T>)} /></td>
                <td className="px-3 py-2"><Input className="!min-h-[36px] !py-1 !text-sm" defaultValue={r.name} onBlur={(e) => e.target.value.trim() && e.target.value !== r.name && onPatch(r.id, { name: e.target.value.trim() } as Partial<T>)} /></td>
                {cols.map((c, i) => <td key={i} className="px-3 py-2">{c.cell(r)}</td>)}
                <td className="px-3 py-2"><Toggle on={r.active} label="啟用" onChange={(b) => onPatch(r.id, { active: b } as Partial<T>)} /></td>
                <td className="px-2 py-2 text-right"><button type="button" onClick={() => setDel(r)} aria-label={`刪除 ${r.name}`} className="rounded-pill px-2 py-1 text-xs text-danger hover:bg-danger/10">刪除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onAdd(name.trim()).then(() => setName("")); }}>
        <Input placeholder={`新${addLabel}名稱`} value={name} onChange={(e) => setName(e.target.value)} className="!max-w-xs" />
        <Button type="submit" size="sm" disabled={!name.trim()}>新增{addLabel}</Button>
      </form>
      {hint && <div className="text-xs text-muted">{hint}</div>}
      <Modal open={!!del} onClose={() => setDel(null)}>
        <div className="font-display text-lg font-bold text-danger">刪除「{del?.name}」？</div>
        <div className="mt-1.5 text-xs text-muted">若已有登記使用此{addLabel}會拒絕刪除，請改為停用。</div>
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1" onClick={() => setDel(null)}>取消</Button>
          <Button variant="danger-solid" size="sm" className="flex-1" onClick={() => del && onDelete(del).then(() => setDel(null)).catch((e: Error) => toast("err", e.message === "in_use" ? `「${del.name}」已有登記使用，請改為停用` : "刪除失敗"))}>刪除</Button>
        </div>
      </Modal>
    </>
  );
}

function Rooms() {
  const qc = useQueryClient(); const toast = useToast();
  const rooms = useRooms().data ?? [];
  const inv = () => qc.invalidateQueries({ queryKey: ["rooms"] });
  const upd = useMutation({ mutationFn: ({ id, ...json }: Partial<Room> & { id: number }) => j(api.api.admin.rooms[":id"].$patch({ param: { id: String(id) }, json })), onSuccess: inv, onError: () => toast("err", "更新失敗") });
  const add = useMutation({
    mutationFn: (name: string) => j(api.api.admin.rooms.$post({ json: { name, colorToken: `room-${(rooms.length % 10) + 1}`, sort: rooms.length, active: true, allowOverlap: false } })),
    onSuccess: () => { inv(); toast("ok", "已新增場地"); }, onError: () => toast("err", "新增失敗（名稱重複？）"),
  });
  const del = useMutation({ mutationFn: (id: number) => j(api.api.admin.rooms[":id"].$delete({ param: { id: String(id) } })), onSuccess: () => { inv(); toast("ok", "已刪除"); } });
  return (
    <Section title="場地">
      <EntityTable items={rooms} addLabel="場地" hint="拖曳 ⋮⋮ 排序。停用的場地不出現在篩選與表單，但舊登記仍可看。「可重疊」= 不做衝突偵測（例：教會室外）。"
        cols={[{ head: "可重疊", cell: (r) => <Toggle on={r.allowOverlap} label="可重疊" onChange={(b) => upd.mutate({ id: r.id, allowOverlap: b })} /> }]}
        onPatch={(id, p) => upd.mutateAsync({ id, ...p })} onDelete={(r) => del.mutateAsync(r.id)} onAdd={(n) => add.mutateAsync(n)} />
    </Section>
  );
}

function Categories() {
  const qc = useQueryClient(); const toast = useToast();
  const cats = useCategories().data ?? [];
  const inv = () => qc.invalidateQueries({ queryKey: ["categories"] });
  const upd = useMutation({ mutationFn: ({ id, ...json }: Partial<Category> & { id: number }) => j(api.api.admin.categories[":id"].$patch({ param: { id: String(id) }, json })), onSuccess: inv, onError: () => toast("err", "更新失敗") });
  const add = useMutation({
    mutationFn: (name: string) => j(api.api.admin.categories.$post({ json: { name, colorToken: "cat-personal", sort: cats.length, active: true } })),
    onSuccess: () => { inv(); toast("ok", "已新增類別"); }, onError: () => toast("err", "新增失敗（名稱重複？）"),
  });
  const del = useMutation({ mutationFn: (id: number) => j(api.api.admin.categories[":id"].$delete({ param: { id: String(id) } })), onSuccess: () => { inv(); toast("ok", "已刪除"); } });
  return (
    <Section title="類別">
      <EntityTable items={cats} addLabel="類別" cols={[]} hint="類別顏色顯示為登記塊左側細條（或切換「類別」色軸時當主色）。"
        onPatch={(id, p) => upd.mutateAsync({ id, ...p })} onDelete={(c) => del.mutateAsync(c.id)} onAdd={(n) => add.mutateAsync(n)} />
    </Section>
  );
}

function Users() {
  const qc = useQueryClient(); const toast = useToast();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => j<AdminUser[]>(api.api.admin.users.$get()) });
  const [q, setQ] = useState("");
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => j(api.api.admin.users[":id"].$patch({ param: { id }, json: { role } })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast("ok", "角色已更新"); }, onError: () => toast("err", "更新失敗"),
  });
  const list = (users.data ?? []).filter((u) => u.name.includes(q)).sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  return (
    <Section title={`使用者與角色（${users.data?.length ?? 0}）`}>
      <Input placeholder="搜尋姓名" value={q} onChange={(e) => setQ(e.target.value)} className="!max-w-xs" />
      <div className="flex flex-col divide-y divide-border rounded-lg border-2 border-border bg-surface">
        {list.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            {u.image ? <img src={u.image} className="h-8 w-8 rounded-full" alt="" /> : <span className="h-8 w-8 rounded-full bg-teal-soft" />}
            <span className="min-w-0 flex-1 truncate text-sm font-bold">{u.name}</span>
            <Segmented value={(u.role ?? "member") as Role} onChange={(role) => setRole.mutate({ id: u.id, role })}
              options={[{ value: "member", label: "會友" }, { value: "staff", label: "幹事" }, { value: "admin", label: "管理" }]} />
          </div>
        ))}
        {!list.length && <div className="px-3 py-4 text-sm text-muted">沒有符合的使用者</div>}
      </div>
    </Section>
  );
}
