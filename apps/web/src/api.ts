import { hc } from "hono/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppType } from "api/app";
import type { BookingInput, BookingInstance, BookingPatch, Category, Conflict, EditScope, Role, Room } from "@smsk/shared";

export const api = hc<AppType>("/");

export class ConflictErr extends Error {
  constructor(public conflicts: Conflict[]) { super("conflict"); }
}
async function ok<T>(p: Promise<Response>): Promise<T> {
  const r = await p;
  if (r.status === 409) throw new ConflictErr((await r.json()).conflicts);
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? (undefined as T) : r.json();
}

export type Me = { id: string; name: string; image?: string | null; role?: Role | null } | null;
export const RANK: Record<Role, number> = { member: 0, staff: 1, admin: 2 };
export const isStaff = (me: Me) => !!me && RANK[me.role ?? "member"] >= 1;
export const isAdmin = (me: Me) => !!me && RANK[me.role ?? "member"] >= 2;

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: () => ok<Me>(api.api.me.$get()), staleTime: 60_000 });
export const useRooms = () => useQuery({ queryKey: ["rooms"], queryFn: () => ok<Room[]>(api.api.rooms.$get()), staleTime: 300_000 });
export const useCategories = () => useQuery({ queryKey: ["categories"], queryFn: () => ok<Category[]>(api.api.categories.$get()), staleTime: 300_000 });
export const useBookings = (from: Date | null, to: Date | null) =>
  useQuery({
    queryKey: ["bookings", from?.toISOString(), to?.toISOString()],
    queryFn: () => ok<BookingInstance[]>(api.api.bookings.$get({ query: { from: from!.toISOString(), to: to!.toISOString() } })),
    enabled: !!from && !!to,
    placeholderData: (prev) => prev,
  });

export function useBookingMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["bookings"] });
  const create = useMutation({ mutationFn: (json: BookingInput) => ok(api.api.bookings.$post({ json })), onSuccess: invalidate });
  const patch = useMutation({
    mutationFn: ({ id, ...json }: BookingPatch & { id: number }) => ok(api.api.bookings[":id"].$patch({ param: { id: String(id) }, json })),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: ({ id, scope, occurrenceStart }: { id: number; scope: EditScope; occurrenceStart?: string }) =>
      ok(api.api.bookings[":id"].$delete({ param: { id: String(id) }, query: { scope, occurrenceStart } })),
    onSuccess: invalidate,
  });
  return { create, patch, remove };
}

export async function login() {
  const res = await fetch("/api/auth/sign-in/oauth2", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ providerId: "line", callbackURL: window.location.pathname }) });
  const { url } = await res.json();
  window.location.href = url;
}
export async function logout() {
  await fetch("/api/auth/sign-out", { method: "POST" });
  window.location.reload();
}
