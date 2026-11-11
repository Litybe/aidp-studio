import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useLoginRequired } from './api/auth'
import { LoginPage } from './components/LoginPage'
import { pageTitle } from './components/nav'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { Toaster } from './components/Toaster'
import { TopBar } from './components/TopBar'
import { BUTTON } from './components/ui/classes'
import { EmptyState } from './components/ui/EmptyState'
import { UnreachablePage } from './components/UnreachablePage'
import { useIsMobile } from './lib/media'
import { useGlobalShortcuts } from './lib/shortcuts'
import { PAGE_LOADERS, prefetchMainPagesWhenIdle } from './pages/loaders'
import { useConnection } from './realtime/context'
import type { ConnectionState } from './realtime/events'

const CommandPalette = lazy(() => import('./components/palette/CommandPalette'))
const GlobalRunDialog = lazy(() => import('./components/run/GlobalRunDialog'))

const selectUnreachable = (state: ConnectionState) => state.phase === 'unreachable'

function Layout() {
  const unreachable = useConnection(selectUnreachable)
  const loginRequired = useLoginRequired()
  const mobile = useIsMobile()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [palette, setPalette] = useState(false)
  const [runDialog, setRunDialog] = useState(false)
  useEffect(prefetchMainPagesWhenIdle, [])
  useGlobalShortcuts({ openPalette: () => setPalette(true), go: (to) => void navigate({ to }) })
  useEffect(() => {
    document.title = `${pageTitle(pathname)} · aidp-studio`
  }, [pathname])
  if (loginRequired) return <LoginPage />
  return (
    <div className="flex h-dvh flex-col bg-canvas text-sm text-ink md:flex-row">
      {mobile ? null : <Sidebar onSearch={() => setPalette(true)} />}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar onSearch={() => setPalette(true)} />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-3 [overflow-wrap:anywhere] md:p-6">
          {unreachable ? <UnreachablePage /> : <Outlet />}
        </main>
      </div>
      <Toaster />
      {mobile ? <TabBar /> : null}
      {palette ? (
        <Suspense fallback={null}>
          <CommandPalette onClose={() => setPalette(false)} onNewRun={() => setRunDialog(true)} />
        </Suspense>
      ) : null}
      {runDialog ? (
        <Suspense fallback={null}>
          <GlobalRunDialog onClose={() => setRunDialog(false)} />
        </Suspense>
      ) : null}
    </div>
  )
}

function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md">
      <EmptyState icon="alert" title="Page inconnue" hint="Cette adresse ne correspond à aucune page du studio.">
        <Link to="/" className={`${BUTTON} mt-2`}>
          Retour à l'accueil
        </Link>
      </EmptyState>
    </div>
  )
}

const rootRoute = createRootRoute({ component: Layout, notFoundComponent: NotFound })

/** One chunk per page: the first load only fetches the shell and the page shown. */
const pages = [
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: lazyRouteComponent(PAGE_LOADERS['/']) }),
  createRoute({ getParentRoute: () => rootRoute, path: '/board', component: lazyRouteComponent(PAGE_LOADERS['/board']) }),
  createRoute({ getParentRoute: () => rootRoute, path: '/issue/$key', component: lazyRouteComponent(PAGE_LOADERS['/issue/$key']) }),
  createRoute({ getParentRoute: () => rootRoute, path: '/inbox', component: lazyRouteComponent(PAGE_LOADERS['/inbox']) }),
  createRoute({ getParentRoute: () => rootRoute, path: '/unity', component: lazyRouteComponent(PAGE_LOADERS['/unity']) }),
  createRoute({ getParentRoute: () => rootRoute, path: '/budget', component: lazyRouteComponent(PAGE_LOADERS['/budget']) }),
  createRoute({ getParentRoute: () => rootRoute, path: '/memory', component: lazyRouteComponent(PAGE_LOADERS['/memory']) }),
  createRoute({ getParentRoute: () => rootRoute, path: '/art', component: lazyRouteComponent(PAGE_LOADERS['/art']) }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/settings',
    component: lazyRouteComponent(PAGE_LOADERS['/settings']),
  }),
] as const

const routeTree = rootRoute.addChildren([...pages])

export function createAppRouter() {
  return createRouter({ routeTree, defaultPreload: false })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
