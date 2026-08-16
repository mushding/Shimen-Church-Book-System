import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Category, Role, Room } from "@smsk/shared";
import { api, isAdmin, useCategories, useMe, useRooms } from "../api";
import { Button, CAT_BG, Input, ROOM_BG, Segmented, catBg, cx, roomBg, useToast } from "../ui";

type AdminUser = { id: string; name: string; image: string | null; role: Role | null; createdAt: string };
const j = async <T,>(p: Promise<Response>): Promise<T> => { const r = await p; if (!r.ok) throw new Error(`${r.status}`); return r.json(); };

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="flex flex-col gap-3"><h2 className="font-display text-base font-bold text-primary">{title}</h2>{children}</section>;
}
function Toggle({ on, onChange, label }: { on: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cx("relative box-border block h-[26px] w-11 shrink-0 rounded-full p-[3px] align-middle outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50",
        on ? "bg-primary" : "bg-border")}>
      <span className={cx("block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out", on ? "translate-x-[18px]" : "translate-x-0")} />
    </button>
  );
}

function Rooms() {
  const qc = useQueryClient(); const toast = useToast();
  const rooms = useRooms().data ?? [];
  const [name, setName] = useState("");
  const inv = () => qc.invalidateQueries({ queryKey: ["rooms"] });
  const upd = useMutation({ mutationFn: ({ id, ...json }: Partial<Room> & { id: number }) => j(api.api.admin.rooms[":id"].$patch({ param: { id: String(id) }, json })), onSuccess: inv, onError: () => toast("err", "更新失敗") });
  const add = useMutation({
    mutationFn: (name: string) => j(api.api.admin.rooms.$post({ json: { name, colorToken: `room-${(rooms.length % 10) + 1}`, sort: rooms.length, active: true, allowOverlap: false } })),
    onSuccess: () => { inv(); setName(""); toast("ok", "已新增場地"); }, onError: () => toast("err", "新增失敗（名稱重複？）"),
  });
  return (
    <Section title="場地">
      <div className="overflow-x-auto rounded-lg border-2 border-border bg-surface">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted">{["顏色", "名稱", "排序", "可重疊", "啟用"].map((h) => <th key={h} className="border-b-2 border-border px-3 py-2.5 font-bold">{h}</th>)}</tr></thead>
          <tbody>
            {[...rooms].sort((a, b) => a.sort - b.sort || a.id - b.id).map((r) => (
              <tr key={r.id} className={cx("border-b border-border", !r.active && "opacity-50")}>
                <td className="px-3 py-2">
                  <select value={r.colorToken} onChange={(e) => upd.mutate({ id: r.id, colorToken: e.target.value })} className={cx("h-8 w-16 rounded-sm text-white text-xs font-bold", roomBg(r.colorToken))}>
                    {Object.keys(ROOM_BG).map((t) => <option key={t} value={t} className="text-fg bg-surface">{t.replace("room-", "色 ")}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><Input className="!min-h-[36px] !py-1 !text-sm" defaultValue={r.name} onBlur={(e) => e.target.value.trim() && e.target.value !== r.name && upd.mutate({ id: r.id, name: e.target.value.trim() })} /></td>
                <td className="px-3 py-2"><Input type="number" className="!min-h-[36px] !w-16 !py-1 !text-sm" defaultValue={r.sort} onBlur={(e) => Number(e.target.value) !== r.sort && upd.mutate({ id: r.id, sort: Number(e.target.value) })} /></td>
                <td className="px-3 py-2"><Toggle on={r.allowOverlap} label="可重疊" onChange={(b) => upd.mutate({ id: r.id, allowOverlap: b })} /></td>
                <td className="px-3 py-2"><Toggle on={r.active} label="啟用" onChange={(b) => upd.mutate({ id: r.id, active: b })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); name.trim() && add.mutate(name.trim()); }}>
        <Input placeholder="新場地名稱" value={name} onChange={(e) => setName(e.target.value)} className="!max-w-xs" />
        <Button type="submit" size="sm" disabled={!name.trim() || add.isPending}>新增場地</Button>
      </form>
      <div className="text-xs text-muted">停用的場地不出現在篩選與表單，但舊登記仍可看。「可重疊」= 不做衝突偵測（例：教會室外）。</div>
    </Section>
  );
}

function Categories() {
  const qc = useQueryClient(); const toast = useToast();
  const cats = useCategories().data ?? [];
  const [name, setName] = useState("");
  const inv = () => qc.invalidateQueries({ queryKey: ["categories"] });
  const upd = useMutation({ mutationFn: ({ id, ...json }: Partial<Category> & { id: number }) => j(api.api.admin.categories[":id"].$patch({ param: { id: String(id) }, json })), onSuccess: inv, onError: () => toast("err", "更新失敗") });
  const add = useMutation({
    mutationFn: (name: string) => j(api.api.admin.categories.$post({ json: { name, colorToken: "cat-personal", sort: cats.length, active: true } })),
    onSuccess: () => { inv(); setName(""); toast("ok", "已新增類別"); }, onError: () => toast("err", "新增失敗（名稱重複？）"),
  });
  return (
    <Section title="類別">
      <div className="overflow-x-auto rounded-lg border-2 border-border bg-surface">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted">{["顏色", "名稱", "排序", "啟用"].map((h) => <th key={h} className="border-b-2 border-border px-3 py-2.5 font-bold">{h}</th>)}</tr></thead>
          <tbody>
            {[...cats].sort((a, b) => a.sort - b.sort || a.id - b.id).map((c) => (
              <tr key={c.id} className={cx("border-b border-border", !c.active && "opacity-50")}>
                <td className="px-3 py-2">
                  <select value={c.colorToken} onChange={(e) => upd.mutate({ id: c.id, colorToken: e.target.value })} className={cx("h-8 w-16 rounded-sm text-white text-xs font-bold", catBg(c.colorToken))}>
                    {Object.keys(CAT_BG).map((t) => <option key={t} value={t} className="text-fg bg-surface">{t.replace("cat-", "")}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><Input className="!min-h-[36px] !py-1 !text-sm" defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && upd.mutate({ id: c.id, name: e.target.value.trim() })} /></td>
                <td className="px-3 py-2"><Input type="number" className="!min-h-[36px] !w-16 !py-1 !text-sm" defaultValue={c.sort} onBlur={(e) => Number(e.target.value) !== c.sort && upd.mutate({ id: c.id, sort: Number(e.target.value) })} /></td>
                <td className="px-3 py-2"><Toggle on={c.active} label="啟用" onChange={(b) => upd.mutate({ id: c.id, active: b })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); name.trim() && add.mutate(name.trim()); }}>
        <Input placeholder="新類別名稱" value={name} onChange={(e) => setName(e.target.value)} className="!max-w-xs" />
        <Button type="submit" size="sm" disabled={!name.trim() || add.isPending}>新增類別</Button>
      </form>
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
