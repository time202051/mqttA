<template>
    <div class="smart-car-container">
        <!-- <h1 class="title">智能小车遥控器</h1> -->
        <div class="control-panel">
            <!-- 右拐按钮 -->
            <div class="lr-container">
                <el-button class="control-button right" @mousedown="startTurn('right')" @mouseup="stopTurn"
                    @touchstart="startTurn('right')" @touchend="stopTurn">
                    <el-icon>
                        <ArrowUp />

                    </el-icon>
                </el-button>
                <!-- 左拐按钮 -->
                <el-button class="control-button left" @mousedown="startTurn('left')" @mouseup="stopTurn"
                    @touchstart="startTurn('left')" @touchend="stopTurn">
                    <el-icon>
                        <ArrowDown />

                    </el-icon>
                </el-button>
            </div>
            <div class="input-container">
                <el-input v-model="input" style="width: 240px" placeholder="请输入指令" clearable />
                <el-button type="primary" @click="sendCommandHandler">发送</el-button>
            </div>
            <div class="qh-container">
                <!-- 前进按钮 -->
                <el-button class="control-button forward" @mousedown="startMove('forward')" @mouseup="stopMove"
                    @touchstart="startMove('forward')" @touchend="stopMove">
                    <el-icon>
                        <ArrowLeft />
                    </el-icon>
                </el-button>
                <!-- 后退按钮 -->
                <el-button class="control-button backward" @mousedown="startMove('backward')" @mouseup="stopMove"
                    @touchstart="startMove('backward')" @touchend="stopMove">
                    <el-icon>
                        <ArrowRight />
                    </el-icon>
                </el-button>
            </div>
        </div>
        <!-- 日志区域 -->
        <div class="log-container">
            <h3>日志</h3>
            <el-scrollbar class="log-scrollbar">
                <div v-for="(log, index) in logs" :key="index" class="log-item">
                    {{ log }}
                </div>
            </el-scrollbar>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import mqtt from 'mqtt'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const client = ref<any>(null)
const logs = ref<string[]>([]) // 日志列表

// 连接 MQTT 服务器
const connectMQTT = () => {
    client.value = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
        clientId: 'smart_car_' + Math.random().toString(16).substr(2, 8),
        protocol: 'wss',
        path: '/mqtt',
        port: 8084,
        rejectUnauthorized: false
    })

    client.value.on('connect', () => {
        console.log('MQTT 连接成功')
        client.value.subscribe('smart_car/control', (error: any) => {
            if (error) {
                console.error('订阅失败:', error)
            } else {
                console.log('订阅成功: smart_car/control')
            }
        })
    })

    client.value.on('message', (topic: string, payload: Buffer) => {
        const message = payload.toString()
        logs.value.unshift(`[${new Date().toLocaleTimeString()}] 收到消息: ${message}`) // 添加日志
    })

    client.value.on('error', (error: any) => {
        console.error('MQTT 连接失败:', error)
    })
}

// 发送控制指令
const sendCommand = (command: string) => {
    if (client.value) {
        client.value.publish('smart_car/control', command, { qos: 0 }, (error: any) => {
            if (error) {
                console.error('指令发送失败:', error)
            }
        })
    }
}

// 开始移动
const startMove = (direction: string) => {
    sendCommand(direction)
}

// 停止移动
const stopMove = () => {
    sendCommand('stop')
}

// 开始转向
const startTurn = (direction: string) => {
    sendCommand(direction)
}

// 停止转向
const stopTurn = () => {
    sendCommand('straight') // 恢复直行
}


const input = ref('') // 输入框内容

// 输入框发送指令 （esp8266接收文本，可以通过文本自定义映射任何事件逻辑）
const sendCommandHandler = () => {
    sendCommand(input.value)
    input.value = '' // 清空输入框内容
}

// 组件挂载时连接 MQTT
onMounted(() => {
    connectMQTT()
})

// 组件卸载时断开 MQTT 连接
onUnmounted(() => {
    if (client.value) {
        client.value.end()
    }
})
</script>

<style scoped>
.smart-car-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background-color: #f5f5f5;
}

.title {
    font-size: 24px;
    margin-bottom: 20px;
    color: #333;
}

.control-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    /* 增加按钮间距 */
}

.control-button {
    width: 100px;
    /* 增大按钮宽度 */
    height: 100px;
    /* 增大按钮高度 */
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.forward {
    background-color: #67c23a;
    color: white;
}

.backward {
    background-color: #f56c6c;
    color: white;
}

.left {
    background-color: #e6a23c;
    color: white;
}

.right {
    background-color: #409eff;
    color: white;
}

.log-container {
    margin-top: 20px;
    width: 400px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 16px;
    position: fixed;
    left: 0;
    top: 65%;
    transform: rotate(-90deg);
    transform-origin: left top;
}

.log-scrollbar {
    max-height: 200px;
    overflow-y: auto;
}

.log-item {
    padding: 8px;
    border-bottom: 1px solid #eee;
    font-size: 14px;
    color: #666;
}

.log-item:last-child {
    border-bottom: none;
}

.qh-container {
    display: flex;
}

.lr-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.input-container {
    margin: 20px 0;
    position: fixed;
    right: 0;
    top: 30%;
    transform: rotate(-90deg);
    transform-origin: right bottom;
}

:deep(.el-button) {
    margin-left: 0 !important;
}
</style>