import { CHORD_MS, isEditable, resolveShortcut } from './shortcuts'

const key = (k: string, over: Partial<KeyboardEvent> = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...over })

describe('resolveShortcut', () => {
  it('opens the palette on Ctrl K, Cmd K, / and ?', () => {
    expect(resolveShortcut(key('k', { ctrlKey: true }), null, 0)).toEqual({ kind: 'palette' })
    expect(resolveShortcut(key('K', { metaKey: true }), null, 0)).toEqual({ kind: 'palette' })
    expect(resolveShortcut(key('/'), null, 0)).toEqual({ kind: 'palette' })
    expect(resolveShortcut(key('?', { shiftKey: true }), null, 0)).toEqual({ kind: 'palette' })
  })

  it('navigates on g then a page key, within the chord window only', () => {
    expect(resolveShortcut(key('g'), null, 1000)).toEqual({ kind: 'chord' })
    expect(resolveShortcut(key('b'), 1000, 1000 + CHORD_MS)).toEqual({ kind: 'go', to: '/board' })
    expect(resolveShortcut(key('i'), 1000, 1000 + CHORD_MS + 1)).toBeNull()
    expect(resolveShortcut(key('$'), 1000, 1200)).toEqual({ kind: 'go', to: '/budget' })
    expect(resolveShortcut(key('h'), 1000, 1200)).toEqual({ kind: 'go', to: '/' })
  })

  it('leaves modified keys and plain letters alone', () => {
    expect(resolveShortcut(key('b', { altKey: true }), 1000, 1100)).toBeNull()
    expect(resolveShortcut(key('b'), null, 0)).toBeNull()
  })
})

describe('isEditable', () => {
  it('treats fields and dialogs as typing surfaces', () => {
    const input = document.createElement('input')
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const inside = document.createElement('button')
    dialog.append(inside)
    expect(isEditable(input)).toBe(true)
    expect(isEditable(inside)).toBe(true)
    expect(isEditable(document.createElement('div'))).toBe(false)
    expect(isEditable(null)).toBe(false)
  })
})
