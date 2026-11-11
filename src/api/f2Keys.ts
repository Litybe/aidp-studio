/** Query keys of the F2 pages. Prefixes let one SSE event invalidate a whole family. */
export const f2Keys = {
  unity: ['unity'] as const,
  unityStatus: ['unity', 'status'] as const,
  usageBy: (groupBy: string, from?: string) => ['usage', groupBy, from ?? ''] as const,
  budgetAnomalies: ['budget', 'anomalies'] as const,
  pixellab: ['budget', 'pixellab'] as const,
  settingsAll: ['settings'] as const,
  settings: (name: string) => ['settings', name] as const,
  catalog: (name: string) => ['catalog', name] as const,
  dispatcherSlots: ['dispatcher', 'slots'] as const,
  memory: ['memory'] as const,
  memoryList: (status: string, kind: string, q: string) => ['memory', 'list', status, kind, q] as const,
  memoryModel: ['memory-model'] as const,
  memoryProposed: ['memory', 'proposed'] as const,
  ragSearch: (q: string, source: string) => ['rag', q, source] as const,
  artTickets: ['tickets', 'art'] as const,
  artFiles: (ticketKey: string) => ['runs', 'art-files', ticketKey] as const,
}
