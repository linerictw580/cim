import { contextBridge } from 'electron'

// 階段 0：先暴露空的 api 命名空間，後續階段逐步補上方法
contextBridge.exposeInMainWorld('api', {})
