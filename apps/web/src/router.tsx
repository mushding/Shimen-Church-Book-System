import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { CalendarPage } from "./pages/CalendarPage";
import { AdminPage } from "./pages/AdminPage";

const root = createRootRoute({ component: () => <Outlet /> });
const index = createRoute({ getParentRoute: () => root, path: "/", component: CalendarPage });
const admin = createRoute({ getParentRoute: () => root, path: "/admin", component: AdminPage });
export const router = createRouter({ routeTree: root.addChildren([index, admin]) });
declare module "@tanstack/react-router" { interface Register { router: typeof router } }
