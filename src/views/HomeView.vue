<template>
  <div>
    <div class="chat-container">
      <div class="chat-header">
        <div class="header-title">
          <!-- <span class="header-names">{{ groupChatTitle.join() }}</span> -->
          <span class="header-meta">{{ userName }}匿名聊天室（在线：{{ onlineCount }}）</span>
        </div>
      </div>
      <div ref="chatMessagesRef" class="chat-messages">
        <div
          v-for="(item, index) in messageList"
          :key="index"
          :class="['message-item', item.isMe ? 'me' : 'other']"
        >
          <!-- 头像 -->
          <div class="avatar" v-if="!item.isMe">
            {{ item.userName }}
          </div>
          <!-- 消息内容 -->
          <div v-if="item.isImage" class="message-content">
            <el-image
              style="width: 100px; height: 100px"
              :src="item.message"
              :zoom-rate="1.2"
              :max-scale="7"
              :min-scale="0.2"
              :preview-src-list="[item.message]"
              show-progress
              :initial-index="1"
              fit="cover"
              hide-on-click-modal
            />
          </div>
          <div v-else class="message-content">
            <span v-html="item.message"></span>
          </div>
          <!-- 消息时间 -->
          <div class="message-time">
            {{ item.time }}
          </div>
        </div>
      </div>
      <div class="chat-input-container">
        <div class="chat-input">
          <input
            ref="inputRef"
            v-model="message"
            placeholder="输入消息..."
            @keyup.enter="sendMessage"
            @focus="handleInputFocus"
          />
          <button class="emoji-button" @click="toggleEmojiPicker">😀</button>
          <input
            type="file"
            accept="image/*"
            @change="sendImage"
            style="display: none"
            id="fileInput"
          />
          <label for="fileInput" class="image-button">📷</label>
        </div>
        <button class="send-button" @click="sendMessage">发送</button>
        <div v-if="showEmojiPicker" class="emoji-picker-container">
          <EmojiPicker
            :native="true"
            @select="onSelectEmoji"
            hide-search
            hide-group-names
            display-recent
            disable-sticky-group-names
            disable-skin-tones
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import mqtt from 'mqtt'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import { getRandomChineseName } from '../utils/randomChineseName.js'

const STORAGE_KEYS = {
  messages: 'chat_messages',
  users: 'chat_users',
  me: 'chat_userName',
}
const MAX_CACHE = 500

const randomChineseName = getRandomChineseName()
const client = ref<any>(null)
const messageList = ref<any[]>([])
const clientId = 'client_' + Math.random().toString(16).substr(2, 8)
const storedName = localStorage.getItem(STORAGE_KEYS.me)
const userName = ref(storedName || randomChineseName)
if (!storedName) {
  localStorage.setItem(STORAGE_KEYS.me, userName.value)
}
const groupChatTitle = ref<string[]>([userName.value])
const onlineCount = computed(() => groupChatTitle.value.length)
const message = ref('')
const showEmojiPicker = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

client.value = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
  clientId,
  protocol: 'wss',
  path: '/mqtt',
  port: 8084,
  rejectUnauthorized: false,
})

client.value.on('connect', () => {
  console.log('连接成功')
  client.value.subscribe('vue3/chat')
})

client.value.on('message', (topic: any, payload: any) => {
  console.log('订阅当前主题：', topic, JSON.parse(payload.toString()))
  const info = JSON.parse(payload.toString())
  messageList.value.push({
    ...info,
    time: new Date().toLocaleString(),
    message: info.message,
    isMe: info.userName === userName.value,
    isImage: info.isImage, // 标记是否为图片
  })
  if (!groupChatTitle.value.includes(info.userName)) {
    groupChatTitle.value.push(info.userName)
  }
})

onMounted(() => {
  // 恢复本地缓存
  try {
    const cachedMsgs = JSON.parse(localStorage.getItem(STORAGE_KEYS.messages) || '[]')
    const cachedUsers = JSON.parse(localStorage.getItem(STORAGE_KEYS.users) || '[]')
    if (Array.isArray(cachedMsgs)) {
      messageList.value = cachedMsgs.slice(-MAX_CACHE)
    }
    const usersSet = new Set<string>([...cachedUsers, userName.value])
    groupChatTitle.value = Array.from(usersSet)
  } catch (e) {
    console.warn('恢复缓存失败：', e)
  }
})

const saveCache = () => {
  try {
    const clipped = messageList.value.slice(-MAX_CACHE)
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(clipped))
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(groupChatTitle.value))
  } catch (e) {
    console.warn('写入缓存失败：', e)
  }
}

watch(messageList, saveCache, { deep: true })
watch(groupChatTitle, saveCache, { deep: false })

// 发布消息
const sendMessage = () => {
  const messageData = {
    userName: userName.value,
    message: message.value,
    isImage: false, // 标记是否为图片
  }
  if (message.value.trim()) {
    client.value.publish(
      'vue3/chat',
      JSON.stringify(messageData),
      {
        qos: 1,
        retain: false,
      },
      (error: any) => {
        if (error) {
          console.log('发布失败：', error)
        } else {
          console.log('发布成功', message.value)
          message.value = ''
        }
      },
    )
  }
}

// 选择表情包
const onSelectEmoji = (emoji: any) => {
  message.value += emoji.i
  inputRef.value?.focus()
  showEmojiPicker.value = false
}

// 切换表情包选择器的显示/隐藏
const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value
}

// 选择图片并发送
const sendImage = (event: Event) => {
  const fileInput = event.target as HTMLInputElement
  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0]
    const reader = new FileReader()
    reader.onload = () => {
      const base64Image = reader.result as string
      const messageData = {
        userName: userName.value,
        message: base64Image,
        isImage: true, // 标记为图片
      }
      client.value.publish(
        'vue3/chat',
        JSON.stringify(messageData),
        {
          qos: 1,
          retain: false,
        },
        (error: any) => {
          if (error) {
            console.log('图片发送失败：', error)
          } else {
            console.log('图片发送成功')
          }
        },
      )
    }
    reader.readAsDataURL(file)
  }
}

const getLastChar = (name: string) => {
  return name.slice(-1) // 提取最后一个字
}

const chatMessagesRef = ref<HTMLDivElement | null>(null)
const handleInputFocus = () => {
  // console.log('focus');
  // if (chatMessagesRef.value) {
  //   // 使用 nextTick 确保 DOM 更新完成后再滚动
  //   nextTick(() => {
  //     chatMessagesRef.value!.scrollTop = chatMessagesRef.value!.scrollHeight
  //   })
  // }
}
// 监听 messageList 的变化，滚动到最下方
watch(
  messageList,
  () => {
    if (chatMessagesRef.value) {
      // 使用 nextTick 确保 DOM 更新完成后再滚动
      nextTick(() => {
        chatMessagesRef.value!.scrollTop = chatMessagesRef.value!.scrollHeight
      })
    }
  },
  { deep: true },
)

onUnmounted(() => {
  client.value.end()
})
</script>

<style scoped>
.chat-container {
  margin: 0 auto;
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
  box-sizing: border-box;
}

.chat-header {
  background-color: #42b983;
  color: white;
  padding: 10px;
  text-align: center;
}

.header-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
}

.header-names {
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

.header-meta {
  white-space: nowrap;
}

.chat-messages {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
}

.message-item {
  margin-bottom: 15px;
  display: flex;
  flex-direction: column;
}

.message-item.me {
  align-items: flex-end;
}

.message-item.other {
  align-items: flex-start;
}

.message-content {
  max-width: 70%;
  padding: 10px;
  border-radius: 8px;
  position: relative;
}

.message-item.me .message-content {
  background-color: #42b983;
  color: white;
  border-bottom-right-radius: 0;
}

.message-item.other .message-content {
  background-color: white;
  color: #333;
  border-bottom-left-radius: 0;
}

.message-time {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}

.chat-input-container {
  display: flex;
  align-items: flex-end;
  padding: 8px;
  background-color: white;
  border-top: 1px solid #ddd;
  position: relative;
}

.chat-input {
  flex: 1;
  display: flex;
  align-items: center;
  margin-right: 10px;
}

.chat-input input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-right: 10px;
}

.emoji-button {
  padding: 10px;
  background-color: transparent;
  border: none;
  cursor: pointer;
  font-size: 20px;
}

.send-button {
  padding: 10px 20px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.send-button:hover {
  background-color: #3aa876;
}

.emoji-picker-container {
  position: absolute;
  bottom: 60px;
  right: 10px;
  z-index: 10;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
</style>
