import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { UnreachablePage } from './components/UnreachablePage'
import { useConnection } from './realtime/context'
import type { ConnectionState } from './realtime/events'

const selectUnreachable = (state: ConnectionState) => state.phase === 'unreachable'

function Layout() {
  const unreachable = useConnection(selectUnreachable)
  return (
    <div className="flex h-screen flex-col bg-slate-950 text-sm text-slate-200">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">{unreachable ? <UnreachablePage /> : <Outlet />}</main>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <section>
      <h1 className="text-lg font-semibold text-slate-100">Page inconnue</h1>
      <Link to="/board" className="mt-2 inline-block text-sky-400 hover:text-sky-300">
        Retour au board
      </Link>
    </section>
  )
}

const rootRoute = createRootRoute({ component: Layout, notFoundComponent: NotFound })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/board' })
  },
})

/** One chunk per page: the first load only fetches the shell and the page shown. */
const pages = [
  createRoute({ getParentRoute: () => rootRoute, path: '/board', component: lazyRouteComponent(() => import('./pages/BoardPage')) }),
  createRoute({ getParentRoute: () => rootRoute, path: '/inbox', component: lazyRouteComponent(() => import('./pages/InboxPage')) }),
  createRoute({ getParentRoute: () => rootRoute, path: '/unity', component: lazyRouteComponent(() => import('./pages/unity/UnityPage')) }),
  createRoute({ getParentRoute: () => rootRoute, path: '/budget', component: lazyRouteComponent(() => import('./pages/budget/BudgetPage')) }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: lazyRouteComponent(() => import('./pages/SettingsPage')),
  }),
] as const

const routeTree = rootRoute.addChildren([indexRoute, ...pages])

export function createAppRouter() {
  return createRouter({ routeTree, defaultPreload: false })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
