export type PdfPage = { id: string; sourceIndex: number; rotation: number }
export type EditorState = { pages: PdfPage[]; original: PdfPage[]; deleted: PdfPage[] }
export type EditorAction =
  | { type: "load"; count: number }
  | { type: "move"; activeId: string; overId: string }
  | { type: "rotate"; id: string; degrees: 90 | -90 }
  | { type: "delete"; id: string }
  | { type: "restore" }
  | { type: "reset" }

export const initialEditorState: EditorState = { pages: [], original: [], deleted: [] }

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "load") {
    const pages = Array.from({ length: action.count }, (_, sourceIndex) => ({
      id: `page-${sourceIndex}`,
      sourceIndex,
      rotation: 0,
    }))
    return { pages, original: pages, deleted: [] }
  }
  if (action.type === "reset") return { ...state, pages: state.original, deleted: [] }
  if (action.type === "restore") {
    const restored = state.deleted.at(-1)
    if (!restored) return state
    const pages = [...state.pages, restored].sort((a, b) => a.sourceIndex - b.sourceIndex)
    return { ...state, pages, deleted: state.deleted.slice(0, -1) }
  }
  if (action.type === "delete") {
    const index = state.pages.findIndex((page) => page.id === action.id)
    if (index < 0) return state
    return {
      ...state,
      pages: state.pages.filter((page) => page.id !== action.id),
      deleted: [...state.deleted, state.pages[index]],
    }
  }
  if (action.type === "rotate") {
    return {
      ...state,
      pages: state.pages.map((page) =>
        page.id === action.id
          ? { ...page, rotation: (page.rotation + action.degrees + 360) % 360 }
          : page,
      ),
    }
  }
  if (action.type === "move") {
    const from = state.pages.findIndex((page) => page.id === action.activeId)
    const to = state.pages.findIndex((page) => page.id === action.overId)
    if (from < 0 || to < 0 || from === to) return state
    const pages = [...state.pages]
    const [moved] = pages.splice(from, 1)
    pages.splice(to, 0, moved)
    return { ...state, pages }
  }
  return state
}
