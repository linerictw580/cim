import { app, BrowserWindow, Tray, nativeImage, ipcMain, screen } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'
import { initUpdater } from './updater'
import store from './store'
import trayIcon from '../../build/icon.ico?asset'

// 視窗與系統匣單一常駐；關窗改為隱藏，程式續留背景由系統匣控制
let mainWindow = null
let tray = null
let menuWin = null
// 系統匣客製選單視窗尺寸；由選單頁載入後量測回報，show 時據此貼合內容
let menuSize = { width: 200, height: 150 }

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    icon: trayIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow = win
  win.on('ready-to-show', () => win.show())

  // 關窗攔截：非「真正結束」時只隱藏視窗，程式續留系統匣背景執行
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      win.hide()
      showTrayHintOnce()
    }
  })
  win.on('closed', () => {
    mainWindow = null
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    win.loadURL(rendererUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 顯示主視窗；若已被銷毀則重建
function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

// 顯示視窗並通知 renderer 切換到指定分頁（供系統匣「設定」使用）
function navigateTo(page) {
  const needCreate = !mainWindow || mainWindow.isDestroyed()
  showWindow()
  if (needCreate) {
    // 重建的視窗需等載入完成再送，否則事件會遺失
    mainWindow.webContents.once('did-finish-load', () =>
      mainWindow.webContents.send('nav:goto', page)
    )
  } else {
    mainWindow.webContents.send('nav:goto', page)
  }
}

// 首次關窗進背景時，於系統匣跳出氣泡提示程式仍在執行（只提示一次）
function showTrayHintOnce() {
  if (!tray || store.get('trayHintShown')) return
  store.set('trayHintShown', true)
  tray.displayBalloon({
    icon: trayIcon,
    title: 'CIM 仍在背景執行',
    content: '視窗已收合到系統匣。點擊圖示可重新開啟，右鍵選單可完全結束。'
  })
}

// 客製系統匣選單視窗：無邊框透明小窗，載入 tray-menu.html，失焦即關閉
function createMenuWindow() {
  menuWin = new BrowserWindow({
    width: menuSize.width,
    height: menuSize.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    menuWin.loadURL(`${rendererUrl}/tray-menu.html`)
  } else {
    menuWin.loadFile(join(__dirname, '../renderer/tray-menu.html'))
  }

  // 失焦（點選單以外處）即關閉
  menuWin.on('blur', () => menuWin.hide())
}

// 於游標附近彈出客製選單，並夾在當前螢幕工作區內
function showTrayMenu() {
  if (!menuWin || menuWin.isDestroyed()) return
  const pt = screen.getCursorScreenPoint()
  const { workArea } = screen.getDisplayNearestPoint(pt)
  const { width, height } = menuSize
  // 預設出現在游標左上（貼近右下工作列的自然方向）
  let x = pt.x - width
  let y = pt.y - height
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - width))
  y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - height))
  menuWin.setBounds({ x, y, width, height })
  menuWin.show()
  menuWin.focus()
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(trayIcon))
  tray.setToolTip('CIM - Claude Instance Manager')

  // 左鍵開啟／聚焦主視窗；右鍵彈出客製選單
  tray.on('click', () => showWindow())
  tray.on('right-click', () => showTrayMenu())
}

// 系統匣選單頁的 IPC：回報尺寸、觸發動作
function registerTrayIpc() {
  ipcMain.on('tray:menuSize', (_e, size) => {
    if (size && size.width && size.height) {
      menuSize = { width: Math.ceil(size.width), height: Math.ceil(size.height) }
    }
  })

  ipcMain.on('tray:action', (_e, id) => {
    menuWin?.hide()
    if (id === 'open') showWindow()
    else if (id === 'settings') navigateTo('settings')
    else if (id === 'quit') {
      app.isQuitting = true
      app.quit()
    }
    // 'close' → 僅關閉選單，不執行動作
  })
}

// 單一實例：背景常駐時再次啟動只聚焦既有視窗，避免出現第二個匣圖示
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())

  app.whenReady().then(() => {
    registerIpc()
    registerTrayIpc()
    createWindow()
    createMenuWindow()
    createTray()
    initUpdater()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // 有系統匣常駐，關閉視窗不結束程式；真正結束由系統匣「停止 CIM」觸發
  app.on('window-all-closed', () => {})

  // 任何路徑觸發的結束（含更新安裝 quitAndInstall）都放行關窗攔截
  app.on('before-quit', () => {
    app.isQuitting = true
  })
}
