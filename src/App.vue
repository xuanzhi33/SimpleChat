<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useSettingsStore } from './stores/settings';
import { useChatStore } from './stores/chat';
import { Toaster } from '@/components/ui/sonner';
import Home from './views/HomeView.vue';
import SetupDialog from './components/settings/SetupDialog.vue';

const settingsStore = useSettingsStore();
const showSetup = ref(false);

const needsSetup = computed(() => settingsStore.models.length === 0);

onMounted(async () => {
  settingsStore.applyColorMode();
  settingsStore.applyLanguage();

  // 初始化 chat store，从 IndexedDB 加载会话
  const chatStore = useChatStore();
  await chatStore.initializeStore();

  // 检查是否需要显示初始化对话框
  if (needsSetup.value) {
    showSetup.value = true;
  }
});
</script>

<template>
  <Home />
  <SetupDialog v-model:open="showSetup" />
  <Toaster rich-colors position="top-center" />
</template>
