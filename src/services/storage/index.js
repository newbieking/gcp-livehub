import { config } from '../../config/index.js';
import { FileMessageStore } from './fileStore.js';
import { MemoryMessageStore } from './memoryStore.js';
import { FirestoreMessageStore } from './firestoreStore.js';

/**
 * 存储驱动工厂 (Storage Driver Factory)
 * 根据配置环境与开关 (STORAGE_DRIVER) 一键动态实例化
 */
function createMessageStore() {
  const driver = (config.storage.driver || 'file').toLowerCase();

  switch (driver) {
    case 'firestore':
      console.log(`[Storage Factory] 正在初始化 Firestore 存储驱动...`);
      return new FirestoreMessageStore(config.storage.firestore);

    case 'memory':
      console.log(`[Storage Factory] 正在初始化纯内存驱动...`);
      return new MemoryMessageStore();

    case 'file':
    default:
      console.log(`[Storage Factory] 正在初始化本地文件存储驱动...`);
      return new FileMessageStore();
  }
}

export const messageStore = createMessageStore();
