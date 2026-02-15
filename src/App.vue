<script setup lang="ts">
import { onMounted } from 'vue';
import { useSettingsStore } from './stores/settings';
import { useChatStore } from './stores/chat';
import { Toaster } from '@/components/ui/sonner';
import Home from './views/HomeView.vue';

onMounted(async () => {
  const settingsStore = useSettingsStore();
  settingsStore.applyColorMode();
  settingsStore.applyLanguage();

  // 初始化 chat store，从 IndexedDB 加载会话
  const chatStore = useChatStore();
  await chatStore.initializeStore();
});
</script>

<template>
  <Home />
  <Toaster rich-colors position="top-center" />
</template>
