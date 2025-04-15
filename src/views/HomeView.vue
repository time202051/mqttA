<template>
  <div>
    <h1>MQTT通信示例</h1>
    <input v-model="message" placeholder="输入要发送的消息" />
    <button @click="sendMessage">发送</button>
    <div>
      <h2>接收到的消息：</h2>
      <p>{{ receivedMessage }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import mqtt from 'mqtt'

const client = ref<any>(null);
const receivedMessage = ref('')

client.value = mqtt.connect('/mqtt', {
  clientId: 'vue3_client_' + Math.random().toString(16).substr(2, 8)
})

client.value.on('connect', () => {
  console.log('MQTT连接成功')
  client.value.subscribe('vue3/demo')
})

client.value.on('message', (topic: any, payload: any) => {
  console.log('订阅当前主题：', topic, payload.toString());
  receivedMessage.value = payload.toString()
})

const message = ref('') // 输入的消息
// 发布
const sendMessage = () => {
  if (message.value.trim()) {
    // 发布
    client.value.publish('vue3/demo', message.value, {
      qos: 1,  // 设置QoS级别为1，确保消息至少传递一次
      retain: false
    }, (error: any) => {
      if (error) {
        console.log('MQTT发布失败：', error);
      } else {
        console.log('MQTT发布成功', message.value);
        message.value = ''  // 清空输入
      }
    })
  }
}

// 断开连接
onUnmounted(() => {
  client.value.end()
})
</script>

<!-- <template>
  <div>
    <h1>MQTT通信示例</h1>
    <input v-model="message" placeholder="输入要发送的消息" />
    <button @click="sendMessage">发送</button>
    <div>
      <h2>接收到的消息：</h2>
      <p>{{ receivedMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import mqttClient from '@/utils/mqttClient'

const message = ref('')
const receivedMessage = ref('')

// 连接MQTT
mqttClient.connect('ws://broker.emqx.io:8083/mqtt', {
  clientId: 'vue3_client_' + Math.random().toString(16).substr(2, 8)
})

// 订阅主题
onMounted(() => {
  mqttClient.subscribe('vue3/demo', (msg) => {
    console.log('接受到返回的消息：', msg);

    receivedMessage.value = msg
  })
})

// 发送消息
const sendMessage = () => {
  if (message.value.trim()) {
    mqttClient.publish('vue3/demo', message.value)
    message.value = ''
  }
}

// 断开连接
onUnmounted(() => {
  mqttClient.disconnect()
})
</script> -->