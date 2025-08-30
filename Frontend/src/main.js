const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
// TODO: 暫時關閉後端服務
// const { setupServer } = require('./server')
// const ServiceManager = require('./backend/services/python-service-manager')

let mainWindow
// let serverInstance  // 保留註釋，未來可能恢復後端
// let serviceManager   // 保留註釋，未來可能恢復後端
let isDialogOpen = false

// 獲取正確的圖示路徑
function getIconPath() {
  const basePaths = [
    // 開發環境路徑 - img 子資料夾
    path.join(__dirname, './renderer/assets/img'),
    // 開發環境路徑 - assets 直接路徑
    path.join(__dirname, './renderer/assets'),
    // 相對路徑 (如果在 src 目錄中) - img 子資料夾
    path.join(__dirname, '../src/renderer/assets/img'),
    // 相對路徑 (如果在 src 目錄中) - assets 直接路徑
    path.join(__dirname, '../src/renderer/assets'),
    // 打包後的路徑 - img 子資料夾
    path.join(process.resourcesPath, 'src/renderer/assets/img'),
    // 打包後的路徑 - assets 直接路徑
    path.join(process.resourcesPath, 'src/renderer/assets'),
    // 備用路徑 - src/assets
    path.join(__dirname, './assets'),
    // 備用路徑 - 專案根目錄 assets
    path.join(__dirname, '../assets')
  ]
  
  // 支援的圖示格式 (按優先順序: ico > png)
  const iconFormats = ['icon.ico', 'icon.png', 'logo.ico', 'logo.png']
  
  
  for (const basePath of basePaths) {
    for (const iconFormat of iconFormats) {
      const iconPath = path.join(basePath, iconFormat)
      try {
        if (fs.existsSync(iconPath)) {
          return iconPath
        }
      } catch (error) {
        console.warn(`Could not access icon at: ${iconPath} - ${error.message}`)
      }
    }
  }
  
  console.warn('No icon found, using default system icon')
  return undefined // 使用系統預設圖示
}

// 單一實例鎖定功能
const gotTheLock = app.requestSingleInstanceLock()

// 如果無法獲取鎖，則表示已有實例在運行，退出應用
if (!gotTheLock) {
  app.quit()
} else {
  // 當第二個實例嘗試啟動時，將焦點聚焦到第一個實例的視窗
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // 建立視窗並啟動應用
  app.whenReady().then(createWindow)
}

async function createWindow() {
  // 設置主視窗
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // 移除默認框架
    transparent: false,
    icon: getIconPath(),
    // titleBarStyle: 'hidden', // 隱藏標題欄
    webPreferences: {
      webSecurity: false,
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, './preload/preload.js')
    },
  })

  // 在窗口加載完成後再顯示，可以避免白屏
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // 前端模式：使用外部 API 服務
  console.log('📱 前端模式啟動 - 使用外部 API 服務')
  
  /*
  // 初始化並啟動所有服務
  console.log('🔧 初始化服務管理器...')
  serviceManager = new ServiceManager()
  
  try {
    console.log('🔧 準備服務依賴...')
    await serviceManager.prepareDependencies()
    
    console.log('🚀 啟動所有服務...')
    await serviceManager.startServices()
    
    console.log('✅ 所有服務啟動完成')
  } catch (error) {
    console.error('❌ 服務啟動失敗:', error)
    console.warn('⚠️ 主應用將繼續啟動，但部分服務功能可能不可用')
  }

  // 啟動 Express 服務器
  serverInstance = await setupServer()
  */

  // 根據環境加載不同的 URL
  if (process.env.NODE_ENV === 'development') {
    await mainWindow.loadURL('http://localhost:3333')
    mainWindow.webContents.openDevTools()
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
  
  // 處理視窗控制 (最小化、最大化、關閉)
  ipcMain.on('window-minimize', () => {
    mainWindow.minimize()
  })
  
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  
  ipcMain.on('window-close', () => {
    mainWindow.close()
  })
}

app.on('window-all-closed', async () => {
  // 前端模式：不需要關閉後端服務
  /*
  // 關閉 Express 服務器 (後端模式時使用)
  if (serverInstance) {
    serverInstance.close()
  }
  */
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 前端模式：不需要服務關閉邏輯
/*
// 後端模式時使用：在應用退出前優雅關閉所有服務
app.on('before-quit', async (event) => {
  if (serviceManager && !serviceManager.isShuttingDown) {
    event.preventDefault() // 暫停退出流程
    
    console.log('🛑 應用退出前關閉所有服務...')
    try {
      await serviceManager.shutdown()
      console.log('✅ 所有服務已安全關閉，應用可以退出')
      app.quit() // 手動退出
    } catch (error) {
      console.error('❌ 服務關閉失敗:', error)
      app.quit() // 強制退出
    }
  }
})
*/

ipcMain.handle('dialog:openFile', async (event, options) => {
  // 如果已經有對話框開啟，直接返回
  if (isDialogOpen) {
    console.log('Dialog is already open')
    return { canceled: true }
  }
  
  isDialogOpen = true
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '文件', extensions: ['doc', 'docx', 'pdf'] }
      ]
    })
    return result
  } finally {
    isDialogOpen = false
  }
})

// 註冊目錄選擇對話框處理程序
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result
})

