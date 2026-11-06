/**
 * 前端基础常量与配置
 */
export const STORAGE_KEYS = {
  USER_ID: 'livehub_user_id',
  USERNAME: 'livehub_username',
  DEVICE_ID: 'livehub_device_id',
  AUTH_TOKEN: 'livehub_auth_token',
  AUTH_TYPE: 'livehub_auth_type',
  BOUND_ID: 'livehub_bound_id',
  UNREAD_PREFIX: 'livehub_unread_',
  CONTACTS_PREFIX: 'livehub_contacts_',
  LAST_READ_PREFIX: 'livehub_last_read_'
};

export const DEFAULT_ROOM = '大厅讨论区';

export const SOCKET_CONFIG = {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ['websocket', 'polling']
};
