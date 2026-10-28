// Orca custom editor for .excalidraw files. Orca owns the buffer, dirty state and saving; this frame
// renders the document's text and posts full-text edits back (see build/README.md).
// The baseline, version gating, `source` preservation and flush follow stablyai/orca#27413 by
// Roughriver74, which first brought Excalidraw into Orca's editor.
import './sandbox-shims.js'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  CaptureUpdateAction,
  Excalidraw,
  MainMenu,
  WelcomeScreen,
  getNonDeletedElements,
  hashElementsVersion,
  restore,
  serializeAsJSON
} from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { parseExcalidrawScene, withExcalidrawSceneSource } from './excalidraw-scene.js'

const EDIT_DEBOUNCE_MS = 250

const UI_OPTIONS = {
  canvasActions: {
    // Why: the frame has no file system or downloads; Orca saves the document itself.
    loadScene: false,
    saveToActiveFile: false,
    export: false,
    saveAsImage: false,
    toggleTheme: false,
    changeViewBackgroundColor: true,
    clearCanvas: true
  },
  tools: { image: true }
}

function readTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/** Changes that reach the saved file; selection, scroll and zoom do not. */
function sceneVersion(elements, appState, files) {
  return [
    hashElementsVersion(elements),
    appState.viewBackgroundColor,
    appState.gridModeEnabled,
    appState.gridSize,
    appState.gridStep,
    Object.keys(files).length
  ].join(':')
}

function restoreScene(data) {
  return restore(data, null, null, { repairBindings: true })
}

function useTheme() {
  const [theme, setTheme] = useState(readTheme)
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

function App() {
  const theme = useTheme()
  const [view, setView] = useState({ status: 'waiting' })
  const apiRef = useRef(null)
  // Mutable editing session; message handlers and onChange read it without re-rendering.
  const session = useRef({
    source: undefined,
    readOnly: true,
    // Why: Excalidraw repairs and normalizes scenes as it loads them, so the baseline is the first
    // scene onChange reports after a load, not the raw text; otherwise opening a file dirties it.
    awaitingBaseline: false,
    baseline: null,
    // The Orca document version the canvas shows; every edit names it so Orca can refuse stale ones.
    documentVersion: null,
    version: null,
    latest: null,
    lastPosted: null,
    timer: undefined,
    mounts: 0
  })

  useEffect(() => {
    const s = session.current

    const serialize = ({ elements, appState, files }) =>
      withExcalidrawSceneSource(
        serializeAsJSON(getNonDeletedElements(elements), appState, files, 'local'),
        s.source
      )

    const flush = () => {
      window.clearTimeout(s.timer)
      s.timer = undefined
      if (s.readOnly || s.baseline === null || s.latest === null || s.documentVersion === null) {
        return
      }
      const next = serialize(s.latest)
      if (next === s.baseline) {
        return
      }
      s.baseline = next
      s.lastPosted = next
      return window.orca.document
        .applyEdit({ baseVersion: s.documentVersion, content: { kind: 'text', text: next } })
        .catch(() => {
          // Orca kept its text: forget what this canvas last sent, so the next change sends the
          // whole scene again (a conflict also brings the newer document, which reloads the canvas).
          s.baseline = ''
          s.lastPosted = null
        })
    }

    s.onChange = (elements, appState, files) => {
      if (appState.isLoading) {
        return
      }
      s.latest = { elements, appState, files }
      const version = sceneVersion(elements, appState, files)
      if (s.awaitingBaseline) {
        s.awaitingBaseline = false
        s.version = version
        s.baseline = serialize(s.latest)
        return
      }
      if (version === s.version) {
        return
      }
      s.version = version
      if (s.readOnly || s.baseline === null) {
        return
      }
      window.clearTimeout(s.timer)
      s.timer = window.setTimeout(flush, EDIT_DEBOUNCE_MS)
    }

    const loadDocument = (text, readOnly) => {
      const api = apiRef.current
      // Why: Orca may hand back the text this frame just posted; reloading it would drop undo history
      // and any stroke still inside the debounce window.
      if (api && text === s.lastPosted) {
        s.readOnly = readOnly
        setView((current) => (current.status === 'ready' ? { ...current, readOnly } : current))
        return
      }
      window.clearTimeout(s.timer)
      s.timer = undefined
      s.baseline = null
      s.latest = null
      s.lastPosted = null
      s.readOnly = readOnly
      let parsed
      try {
        parsed = parseExcalidrawScene(text)
      } catch (error) {
        apiRef.current = null
        setView({ status: 'error', message: error.message })
        return
      }
      s.source = parsed.source
      const scene = restoreScene(parsed.data)
      s.awaitingBaseline = true
      if (api) {
        api.addFiles(Object.values(scene.files))
        api.updateScene({
          elements: scene.elements,
          appState: {
            viewBackgroundColor: scene.appState.viewBackgroundColor,
            gridModeEnabled: scene.appState.gridModeEnabled,
            gridSize: scene.appState.gridSize,
            gridStep: scene.appState.gridStep
          },
          captureUpdate: CaptureUpdateAction.NEVER
        })
        api.history.clear()
        setView((current) => ({ ...current, readOnly }))
        return
      }
      s.mounts += 1
      setView({
        status: 'ready',
        readOnly,
        mountKey: s.mounts,
        initialData: { ...scene, scrollToContent: true }
      })
    }

    const onDocument = (doc) => {
      if (Number.isSafeInteger(doc.version) && doc.content?.kind === 'text') {
        s.documentVersion = doc.version
        loadDocument(doc.content.text, doc.readOnly === true)
      }
    }
    // Orca waits for the returned promise before it saves.
    const subscriptions = [
      window.orca.document.onDidChange(onDocument),
      window.orca.on('editor.flush', () => flush())
    ]
    return () => subscriptions.forEach((subscription) => subscription.dispose())
  }, [])

  if (view.status === 'waiting') {
    return null
  }
  if (view.status === 'error') {
    return (
      <div className="orca-excalidraw-message" role="alert">
        Cannot display this file as an Excalidraw drawing: {view.message}. Switch to Source to fix
        it.
      </div>
    )
  }
  return (
    <Excalidraw
      key={view.mountKey}
      initialData={view.initialData}
      excalidrawAPI={(api) => {
        apiRef.current = api
      }}
      onChange={(elements, appState, files) => session.current.onChange?.(elements, appState, files)}
      onLinkOpen={(_element, event) => event.preventDefault()}
      validateEmbeddable={false}
      aiEnabled={false}
      theme={theme}
      viewModeEnabled={view.readOnly}
      UIOptions={UI_OPTIONS}
    >
      <MainMenu>
        <MainMenu.DefaultItems.SearchMenu />
        <MainMenu.DefaultItems.Help />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.Separator />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
      <WelcomeScreen>
        <WelcomeScreen.Hints.ToolbarHint />
        <WelcomeScreen.Hints.MenuHint>Search, help and canvas background</WelcomeScreen.Hints.MenuHint>
        <WelcomeScreen.Hints.HelpHint />
        <WelcomeScreen.Center>
          <WelcomeScreen.Center.Logo />
          <WelcomeScreen.Center.Heading>Pick a tool and start drawing</WelcomeScreen.Center.Heading>
        </WelcomeScreen.Center>
      </WelcomeScreen>
    </Excalidraw>
  )
}

createRoot(document.getElementById('root')).render(<App />)
