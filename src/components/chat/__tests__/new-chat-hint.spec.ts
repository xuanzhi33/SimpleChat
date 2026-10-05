import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NewChatHint from '@/components/chat/NewChatHint.vue'
import { i18n } from '@/i18n/config'
import { newChatShortcutLabel } from '@/lib/shortcuts'

describe('NewChatHint', () => {
  const wrapper = mount(NewChatHint, { global: { plugins: [i18n] } })

  it('文案和快捷键标签在同一行', () => {
    // 之前是 <p> + <kbd>，块级 <p> 把 kbd 挤到了第二行
    expect(wrapper.find('p').exists()).toBe(false)
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['flex', 'items-center']))
    // 只有「文本 + 键位」两个子节点，中间不留块级盒子
    expect(wrapper.element.childNodes).toHaveLength(2)
    expect(wrapper.element.childNodes[1]!.nodeName).toBe('KBD')
  })

  it('显示对话文案和键位标签', () => {
    expect(wrapper.text()).toContain(i18n.global.t('chat.newConversation'))
    expect(wrapper.text()).toContain(newChatShortcutLabel)
  })
})
