import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire, Module } from "node:module"
import { resolve } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const nativeRequire = createRequire(import.meta.url)

// Use the installed TypeScript compiler; no DOM library or test framework is needed.
function loadSource(relativePath, overrides = {}) {
  const filename = resolve(relativePath)
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const loaded = new Module(filename)
  loaded.filename = filename
  loaded.require = (id) => {
    if (Object.hasOwn(overrides, id)) return overrides[id]
    if (id.startsWith("@/")) return loadSource(`src/${id.slice(2)}.ts`, overrides)
    return nativeRequire(id)
  }
  loaded._compile(compiled, filename)
  return loaded.exports
}

const { DEFAULT_SELECTED_GENRES: defaults } = loadSource("src/lib/constants.ts")
const { isValidGenreArray: validate } = loadSource("src/lib/validators.ts")
const options = { validate }
const key = "selected-genres"
const values = new Map()
const browser = new EventTarget()
browser.localStorage = {
  getItem: (name) => values.get(name) ?? null,
  setItem: (name, value) => values.set(name, value),
}
globalThis.window = browser

// Exercise the external-store adapter directly. React mount/cleanup is covered by GUI acceptance.
let subscribe
const storage = loadSource("src/hooks/useLocalStorage.ts", {
  react: {
    useCallback: (callback) => callback,
    useMemo: (calculate) => calculate(),
    useSyncExternalStore: (listen, getSnapshot) => {
      subscribe = listen
      return getSnapshot()
    },
  },
})
const readStorageAdapter = storage.useLocalStorage
const readValue = () => readStorageAdapter(key, defaults, options)
const crossTab = (changedKey) => {
  const event = new Event("storage")
  Object.defineProperty(event, "key", { value: changedKey })
  browser.dispatchEvent(event)
}

for (const invalid of ["{broken", "[]", '["unknown"]', "false"]) {
  values.set(key, invalid)
  assert.deepEqual(readValue()[0], defaults)
  const unsubscribe = subscribe(() => {})
  assert.equal(values.get(key), JSON.stringify(defaults), "repair invalid persisted genres")
  unsubscribe()
}
await Promise.resolve()

let notifications = 0
readValue()
const unsubscribe = subscribe(() => { notifications += 1 })
readValue()[1]([])
await Promise.resolve()
assert.deepEqual(readValue()[0], [], "allow temporary empty selection on this page")
assert.equal(values.get(key), "[]")
assert.equal(notifications, 1)
readValue()[1]((previous) => [...previous, "Jazz"])
readValue()[1]((previous) => [...previous, "Piano"])
assert.deepEqual(readValue()[0], ["Jazz", "Piano"], "consecutive updaters read the latest value")
await Promise.resolve()
values.set(key, "[]")
crossTab(key)
assert.deepEqual(readValue()[0], defaults, "repair an invalid value from another tab")
values.set(key, '["Jazz"]')
crossTab(key)
assert.deepEqual(readValue()[0], ["Jazz"])
values.clear()
crossTab(null)
assert.deepEqual(readValue()[0], defaults, "storage.clear uses defaults")
await Promise.resolve()
unsubscribe()
const afterUnsubscribe = notifications
crossTab(key)
assert.equal(notifications, afterUnsubscribe, "unsubscribe removes listeners")

const originalGetItem = browser.localStorage.getItem
browser.localStorage.getItem = () => { throw new Error("storage unavailable") }
assert.deepEqual(readValue()[0], defaults)
assert.equal(readValue()[2], true, "unavailable storage still completes initialization")
browser.localStorage.getItem = originalGetItem
delete globalThis.window

// Real React server rendering must neither access browser storage nor start a Server Action.
const { useLocalStorage } = loadSource("src/hooks/useLocalStorage.ts")
function StorageServerProbe() {
  const [genres, , initialized] = useLocalStorage(key, defaults, options)
  assert.deepEqual(genres, defaults)
  assert.equal(initialized, false)
  return null
}
renderToStaticMarkup(React.createElement(StorageServerProbe))

const { usePlaylistManager } = loadSource("src/hooks/usePlaylistManager.ts", {
  "@/app/actions/generateDashboard": {
    generateDashboard: () => assert.fail("playlist generation must only start in an Effect"),
  },
})
const playlistOptions = {
  selectedGenres: ["Jazz"], isGenresInitialized: true,
  effectiveWeather: "Clear", effectiveTimeOfDay: "day",
  actualWeatherType: null, actualTimeOfDay: "day", isMoodTuning: false,
  playlistRefreshTrigger: 0, suspended: false, isGenrePanelOpen: false,
}
let result
function PlaylistProbe({ overrides, duplicateRequest = false }) {
  const manager = usePlaylistManager({ ...playlistOptions, ...overrides })
  const [requested, setRequested] = React.useState(false)
  if (duplicateRequest && !requested) {
    setRequested(true)
    manager.refreshPlaylistByGenre("Jazz")
    manager.refreshPlaylists()
  }
  result = manager
  return null
}
renderToStaticMarkup(React.createElement(PlaylistProbe, { overrides: { suspended: true } }))
assert.equal(result.isLoading, false, "onboarding suspends initial generation")
renderToStaticMarkup(React.createElement(PlaylistProbe))
assert.equal(result.loadingMode, "initial")
renderToStaticMarkup(React.createElement(PlaylistProbe, {
  overrides: { isGenresInitialized: false },
}))
assert.equal(result.isLoading, false, "wait for persisted genres")
renderToStaticMarkup(React.createElement(PlaylistProbe, {
  overrides: { initialPlaylists: [{ id: "jazz", genre: "Jazz" }] }, duplicateRequest: true,
}))
assert.equal(result.loadingMode, "single", "two queued actions keep the first request")
assert.equal(result.currentPlaylist.id, "jazz", "keep the existing playlist while loading")
console.log("Client-state checks passed: storage validation/sync, SSR, deferred and single-flight requests")
