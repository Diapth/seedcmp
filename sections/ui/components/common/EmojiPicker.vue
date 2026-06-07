<template>
  <view class="emoji-picker-container" v-if="visible">
    <scroll-view
      scroll-y
      class="emoji-scroll"
      :show-scrollbar="false"
    >
      <view class="emoji-grid">
        <button
          v-for="emoji in emojis"
          :key="emoji"
          class="emoji-cell"
          :aria-label="`emoji ${emoji}`"
          @click="selectEmoji(emoji)"
        >
          <text class="emoji-text">{{ emoji }}</text>
        </button>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: true },
  mode: {
    type: String,
    default: 'input',
    validator: (v) => ['input', 'reaction'].includes(v)
  }
});

const emit = defineEmits(['select', 'close']);

const emojis = [
  '😀', '😄', '😁', '😊', '😍',
  '🥳', '😂', '🤣', '😉', '😎',
  '🤔', '😮', '😢', '😡', '😭',
  '👍', '👎', '👏', '🙏', '💪',
  '👌', '✌️', '🤝', '🙌', '🫶',
  '❤️', '🔥', '🎉', '✅', '⭐',
  '🚀', '💡', '📌', '📎', '☕'
];

function selectEmoji(emoji) {
  emit('select', emoji);
}
</script>

<style scoped>
.emoji-picker-container {
  width: 280px;
  max-height: 240px;
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background-color: var(--color-bg-surface);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.16);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.emoji-scroll {
  width: 100%;
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  padding: 10px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(5, 48px);
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
}

.emoji-cell {
  width: 48px;
  height: 48px;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 8px;
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.16s ease, transform 0.16s ease;
}

.emoji-cell::after {
  border: none;
}

.emoji-cell:hover,
.emoji-cell:focus-visible {
  background-color: var(--color-bg-hover);
  outline: none;
}

.emoji-cell:active {
  transform: scale(0.94);
}

.emoji-text {
  font-size: 26px;
  line-height: 1;
}

@media (max-width: 768px) {
  .emoji-picker-container {
    width: 100%;
    max-width: 100%;
    max-height: 200px;
  }

  .emoji-grid {
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
  }

  .emoji-cell {
    width: 100%;
    height: 44px;
  }

  .emoji-text {
    font-size: 24px;
  }
}
</style>
