import Dexie, { type EntityTable } from 'dexie'
import type { Conversation } from '@/types/chat'

// 定义数据库
const db = new Dexie('SimpleChatDB') as Dexie & {
  conversations: EntityTable<Conversation, 'id'>
}

// 定义表结构
db.version(1).stores({
  conversations: 'id, updatedAt, createdAt', // id 为主键，updatedAt 和 createdAt 为索引
})

export { db }

// 数据库操作函数
export const dbOperations = {
  // 获取所有会话（按更新时间倒序）
  async getAllConversations(): Promise<Conversation[]> {
    return await db.conversations.orderBy('updatedAt').reverse().toArray()
  },

  // 获取单个会话
  async getConversation(id: string): Promise<Conversation | undefined> {
    return await db.conversations.get(id)
  },

  // 添加或更新会话
  async saveConversation(conversation: Conversation): Promise<void> {
    await db.conversations.put(conversation)
  },

  // 删除会话
  async deleteConversation(id: string): Promise<void> {
    await db.conversations.delete(id)
  },

  // 清空所有会话
  async clearAllConversations(): Promise<void> {
    await db.conversations.clear()
  },
}
