import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { CalendarPage } from "./pages/CalendarPage";
import { AdminPage } from "./pages/AdminPage";
import { useBigText, useDark } from "./ui";

// theme classes (.dark / .big-text) applied here so every route keeps them (admin page used to lose dark mode on refresh)
function Root() { useDark(); useBigText(); return <Outlet />; }
const root = createRootRoute({ component: Root });
const index = createRoute({ getParentRoute: () => root, path: "/", component: CalendarPage });
const admin = createRoute({ getParentRoute: () => root, path: "/admin", component: AdminPage });
export const router = createRouter({ routeTree: root.addChildren([index, admin]) });
declare module "@tanstack/react-router" { interface Register { router: typeof router } }
