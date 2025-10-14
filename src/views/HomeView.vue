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
          <!-- 时间显示（微信风格，居中显示） -->
          <div v-if="shouldShowTime(item, index)" class="time-divider">
            {{ formatTime(item.time) }}
          </div>

          <!-- 头像 -->
          <div class="name" v-if="!item.isMe">
            {{ item.userName }}
          </div>
          <!-- 消息内容 -->
          <div v-if="item.isImage" class="message-content image-message">
            <el-image
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
            {{ item.message }}
            <!-- <span v-html="item.message"></span> -->
          </div>
          <!-- 消息时间 -->
          <!-- <div class="message-time">
            {{ item.time }}
          </div> -->
        </div>
      </div>
      <div class="chat-input-container">
        <div class="chat-input">
          <textarea
            ref="inputRef"
            v-model="message"
            @keyup.enter="handleKeyDown"
            @focus="handleInputFocus"
            class="message-input"
          />
          <!-- <input
            ref="inputRef"
            v-model="message"
            placeholder="输入消息..."
            @keyup.enter="sendMessage"
            @focus="handleInputFocus"
            class="message-input"
          /> -->
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
import { getRandomChineseName } from '@/utils/randomChineseName'

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

// 添加通知相关功能
const isPageVisible = ref(true)
const originalTitle = document.title

// 请求通知权限
const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  return false
}

// 显示通知
const showNotification = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: '/favicon.ico', // 使用你的图标
      tag: 'chat-message', // 防止重复通知
    })
  }
}

// 页面标题闪烁
const flashTitle = (message: string) => {
  let flashCount = 0
  const maxFlashes = 3

  const flash = () => {
    if (flashCount < maxFlashes) {
      document.title = document.title === originalTitle ? `💬 ${message}` : originalTitle
      flashCount++
      setTimeout(flash, 1000)
    } else {
      document.title = originalTitle
    }
  }

  flash()
}

// 监听页面可见性变化
const handleVisibilityChange = () => {
  isPageVisible.value = !document.hidden
  if (!document.hidden) {
    document.title = originalTitle
  }
}

// 在组件挂载时请求通知权限
onMounted(async () => {
  await requestNotificationPermission()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

// 在组件卸载时清理
onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  client.value.end()
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

// 添加声音提示
const playNotificationSound = () => {
  // 创建一个简单的提示音
  const audioContext = new window.AudioContext()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
  oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.3)
}

// 在消息接收时添加声音提示
client.value.on('message', (topic: any, payload: any) => {
  console.log('订阅当前主题：', topic, JSON.parse(payload.toString()))
  const info = JSON.parse(payload.toString())

  // 只对不是自己发送的消息进行提示
  if (info.userName !== userName.value) {
    // 播放提示音
    playNotificationSound()

    // 如果页面不可见，显示通知和标题闪烁
    if (!isPageVisible.value) {
      showNotification(`新消息来自 ${info.userName}`, info.isImage ? '[图片]' : info.message)
      flashTitle(`新消息来自 ${info.userName}`)
    }
  }

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
          inputRef.value?.focus()
        }
      },
    )
  }
}
const handleKeyDown = (event: KeyboardEvent) => {
  // 如果按的是 Enter 键且没有按 Shift 键，发送消息
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
  // 如果按的是 Enter + Shift，允许换行
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
// 判断是否应该显示时间
const shouldShowTime = (currentItem: any, currentIndex: number) => {
  // 第一条消息总是显示时间
  if (currentIndex === 0) return true

  const currentTime = new Date(currentItem.time)
  const prevItem = messageList.value[currentIndex - 1]
  const prevTime = new Date(prevItem.time)

  // 计算时间差（分钟）
  const timeDiff = (currentTime.getTime() - prevTime.getTime()) / (1000 * 60)

  // 如果时间间隔超过5分钟，显示时间
  return timeDiff > 5
}

// 格式化时间显示
const formatTime = (timeString: string) => {
  const date = new Date(timeString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  // 如果是今天，直接显示时：分
  if (messageDate.getTime() === today.getTime()) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  // 如果是昨天
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (messageDate.getTime() === yesterday.getTime()) {
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    return `昨天 ${hour}:${minute}`
  }

  // 计算时间差（天）
  const timeDiff = (today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24)

  // 如果是一周内（2-7天前），显示"周X 时：分"
  if (timeDiff >= 2 && timeDiff <= 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekday = weekdays[date.getDay()]
    const hour = date.getHours().toString().padStart(2, '0')
    const minute = date.getMinutes().toString().padStart(2, '0')
    return `${weekday} ${hour}:${minute}`
  }

  // 如果超过一周，显示"x月x日 时：分"格式
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')

  return `${month}月${day}日 ${hour}:${minute}`
}

// 自动调整输入框高度
const adjustInputHeight = () => {
  const input = inputRef.value
  if (input) {
    input.style.height = 'auto'
    const scrollHeight = input.scrollHeight
    const maxHeight = 140 // 7行的高度 (20px * 7)
    input.style.height = Math.min(scrollHeight, maxHeight) + 'px'
  }
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
// 监听消息内容变化，自动调整高度
watch(message, () => {
  nextTick(() => {
    adjustInputHeight()
  })
})

// 在组件挂载后也调整一次高度
onMounted(() => {
  adjustInputHeight()
})

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
  background-color: #ededed;
  color: #292828;
  padding: 10px;
  text-align: center;
  border-bottom: 1px solid #ddd;
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
  background-color: #ededed;
}
.chat-messages .name {
  color: #8e8e93; /* 微信风格的浅灰色 */
  font-size: 11px; /* 稍微小一点的字体 */
  font-weight: 400; /* 正常字重 */
  margin-bottom: 2px; /* 与消息内容保持适当间距 */
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
  padding: 9px;
  box-sizing: border-box;
  border-radius: 8px;
  position: relative;
  /* 添加换行相关属性 */
  word-wrap: break-word; /* 自动换行 */
  word-break: break-word; /* 优先在单词边界换行 */
  overflow-wrap: break-word; /* 现代浏览器的换行属性 */
  white-space: pre-wrap; /* 保留换行符和空格 */
}

.message-item.me .message-content {
  background-color: #95ec69;
  color: #292828;
  border-bottom-right-radius: 0;
}

.message-item.other .message-content {
  background-color: white;
  color: #292828;
  border-bottom-left-radius: 0;
}

.time-divider {
  width: 100%;
  text-align: center;
  margin: 10px 0;
  font-size: 12px;
  color: #999;
  position: relative;
}
/*
.time-divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background-color: #e5e5e5;
  z-index: 1;
}

.time-divider {
  background-color: #f5f5f5;
  padding: 4px 12px;
  border-radius: 4px;
  display: inline-block;
  position: relative;
  z-index: 2;
} */

.chat-input-container {
  display: flex;
  align-items: flex-end;
  padding: 8px;
  background-color: #ededed;
  border-top: 1px solid #ddd;
  position: relative;
}

.chat-input {
  flex: 1;
  display: flex;
  align-items: flex-end;
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
  margin-bottom: 2px;
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

.message-content.image-message {
  width: 70%;
  background-color: transparent !important;
  border: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
}

/* 或者更具体地针对发送者和接收者的图片消息 */
.message-item.me .message-content.image-message {
  background-color: transparent !important;
  border: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
}

.message-item.other .message-content.image-message {
  background-color: transparent !important;
  border: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
}

.message-input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-right: 10px;
  resize: none; /* 禁止手动调整大小 */
  font-family: inherit;
  font-size: 14px;
  line-height: 1.4;
  min-height: 20px; /* 最小高度 */
  max-height: 140px; /* 最大高度约7行 (20px * 7) */
  overflow-y: auto; /* 超出时显示滚动条 */
}

:deep(.el-image-viewer__mask) {
  opacity: 0.9;
}
.image-button {
  margin-bottom: 13px;
}
</style>
