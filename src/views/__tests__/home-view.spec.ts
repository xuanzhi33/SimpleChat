import { nextTick } from 'vue'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// reka 的 tooltip 定位用 useSize，依赖 ResizeObserver（jsdom 里没有）
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

// Dexie 在 jsdom 里没有 IndexedDB
vi.mock('@/lib/db', () => ({
  db: {},
  dbOperations: {
    getAllConversations: vi.fn(async () => []),
    getConversation: vi.fn(),
    saveConversation: vi.fn(async () => {}),
    deleteConversation: vi.fn(async () => {}),
    clearAllConversations: vi.fn(async () => {}),
  },
}))

vi.mock('vue-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomeView from '@/views/HomeView.vue'
import { i18n } from '@/i18n/config'
import { useChatStore } from '@/stores/chat'

/** 挂载整个主界面；store 在 HomeView 的 setup 里创建（它内部要用 useI18n），之后在组件外取才安全 */
const mountHome = () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(HomeView, { global: { plugins: [pinia, i18n] } })
  return { wrapper, chatStore: useChatStore() }
}

describe('HomeView 快捷键', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('Ctrl+J / Cmd+J 新建对话，其他组合不触发', async () => {
    const { wrapper, chatStore } = mountHome()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, shiftKey: true }))
    await nextTick()
    expect(chatStore.conversations).toHaveLength(0)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }))
    await nextTick()
    expect(chatStore.conversations).toHaveLength(1)
    expect(chatStore.activeConversationId).toBe(chatStore.conversations[0]!.id)

    // Mac 的 ⌘J 同样有效
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', metaKey: true }))
    await nextTick()
    expect(chatStore.conversations).toHaveLength(2)

    // 卸载后监听要跟着摘掉
    wrapper.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }))
    await nextTick()
    expect(chatStore.conversations).toHaveLength(2)
  })
})

describe('边栏会话项', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('选中项用更深的灰底，且不因为选中而加粗', async () => {
    const { wrapper } = mountHome()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }))
    await nextTick()

    const item = wrapper.find('[data-slot="sidebar-menu-button"][data-active="true"]')
    expect(item.exists()).toBe(true)
    const classes = item.classes()
    expect(classes).toContain('data-[active=true]:bg-foreground/10')
    expect(classes).toContain('data-[active=true]:font-normal')

    // 关键：ui/sidebar 的 cva 里那两条默认值必须被 tw-merge 顶掉。
    // 构建产物里 .data-[active=true]:bg-sidebar-accent 排在 bg-foreground/10 之后，
    // 没顶掉的话改了等于没改（font 同理：font-medium 也在 font-normal 前面被覆盖掉）
    expect(classes).not.toContain('data-[active=true]:bg-sidebar-accent')
    expect(classes).not.toContain('data-[active=true]:font-medium')

    // 标题本身固定 medium，选不选中一个样
    expect(item.find('span').classes()).toContain('font-medium')
  })
})
