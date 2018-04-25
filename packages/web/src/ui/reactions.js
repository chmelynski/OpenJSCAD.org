const most = require('most')

function makeReactions (state$, actions$, sinks, sources) {
  const {store, fs, http} = sinks

  // output to storage
  const settingsStorage = state => {
    const {themeName, design, locale, shortcuts} = state
    const {name, mainPath, vtreeMode, parameterDefinitions, parameterDefaults, parameterValues} = design
    return {
      themeName,
      locale,
      shortcuts,
      design: {
        name,
        mainPath,
        vtreeMode,
        parameters: {
          parameterDefinitions,
          parameterDefaults,
          parameterValues
        }
      },
      viewer: {
        axes: {show: state.viewer.axes.show},
        grid: {show: state.viewer.grid.show}
        // autorotate: {enabled: state.viewer.controls.autoRotate.enabled}
      },
      autoReload: state.autoReload,
      instantUpdate: state.instantUpdate
    }
  }
  store(
    most.mergeArray([
      // initial request for localstorage data
      most.just({type: 'read', target: 'settings'}),
      // output settings to local storage for saving everytime they change
      state$
        .map(settingsStorage).map(data => ({type: 'write', target: 'settings', data}))
        .skipRepeatsWith((previousState, currentState) => JSON.stringify(previousState) === JSON.stringify(currentState))
        .delay(1000)// delay the first saving to avoir overwriting existing settings
    ])
  )

  http(
    actions$.requestLoadExample$
      .map(({data}) => ({url: data, id: 'loadExample', type: 'read'}))
  )

  // TODO : move to side effect
  actions$.exportRequested$.forEach(action => {
    console.log('export requested', action)
    const {saveAs} = require('file-saver')
    const {prepareOutput} = require('../core/io/prepareOutput')
    const {convertToBlob} = require('../core/io/convertToBlob')

    const outputData = action.data.data
    const format = action.data.exportFormat
    const blob = convertToBlob(prepareOutput(outputData, {format}))
    // fs.writeFileSync(filePath, buffer)
    saveAs(blob, action.data.defaultExportFilePath)
  })

  const serializeGeometryCache = (cache) => {
    /*
    const fs = require('fs')
    const electron = require('electron').remote
    const serialize = require('serialize-to-js').serialize

    const userDataPath = electron.app.getPath('userData')
    const path = require('path')

    const cachePath = path.join(userDataPath, '/cache.js')
    let data = {}
    Object.keys(cache).forEach(function (key) {
      data[key] = cache[key]// .toCompactBinary()
    })
    const compactBinary = data
    const compactOutput = serialize(compactBinary)
    const content = compactOutput // 'compactBinary=' +
    fs.writeFileSync(cachePath, content) */
  }

  const serializeGeometryCache$ = actions$.setDesignSolids$
    .forEach(x => {
      console.log('set design solids', x)
      /* if (solids) {
        serializeGeometryCache(lookup)
      } */
    })

    // data out to file system sink
  // drag & drops of files/folders have DUAL meaning:
  // * ADD this file/folder to the available ones
  // * OPEN this file/folder
  fs(
    most.mergeArray([
      // injection from drag & drop
      sources.drops
        .map((data) => ({type: 'add', data: data.data, id: 'droppedData'})),
      // data retrieved from http requests
      sources.http
        .filter(response => response.id === 'loadExample' && response.type === 'read')
        .map(response => ({type: 'add', data: response.data, id: 'remoteFile', path: response.url, options: {isRawData: true}})),
      // after data was added to memfs, we get an answer back
      sources.fs
        .filter(response => response.type === 'add')
        .map(({data}) => ({type: 'read', data, id: 'loadDesign', path: data[0].fullPath})),
      // watched data
      state$
        .filter(state => state.design.mainPath !== '')
        .map(state => ({path: state.design.mainPath, enabled: state.autoReload}))
        .skipRepeatsWith((state, previousState) => {
          return JSON.stringify(state) === JSON.stringify(previousState)
        })
        .map(({path, enabled}) => ({
          type: 'watch',
          id: 'watchScript',
          path,
          options: {enabled}})// enable/disable watch if autoreload is set to false
        ),
      // files to read/write
      state$
        .filter(state => state.design.mainPath !== '')
        .map(state => state.design.mainPath)
        .skipRepeatsWith((state, previousState) => {
          return JSON.stringify(state) === JSON.stringify(previousState)
        })
        .map(path => ({type: 'read', id: 'loadDesign', path}))
      /* most.just()
        .map(function () {
           const electron = require('electron').remote
          const userDataPath = electron.app.getPath('userData')
          const path = require('path')

          const cachePath = path.join(userDataPath, '/cache.js')
          const cachePath = 'gnagna'
          return {type: 'read', id: 'loadCachedGeometry', path: cachePath}
        }) */
    ])
  )
}

module.exports = makeReactions
