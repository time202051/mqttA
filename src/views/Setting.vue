<template>
    <div class="setting-box">
        <el-dropdown>
            <el-icon>
                <Setting />
            </el-icon>
            <template #dropdown>
                <el-dropdown-menu>
                    <!-- 递归生成菜单项 -->
                    <el-dropdown-item v-for="item in menuItems" :key="item.path" @click="navigateTo(item.path)">
                        {{ item.name }}
                    </el-dropdown-item>
                </el-dropdown-menu>
            </template>
        </el-dropdown>
    </div>
    <RouterView />
</template>

<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 递归生成菜单项
const generateMenuItems = (routes: any[]) => {
    const items: any[] = []
    routes.forEach(route => {
        if (route.name && route.path) {
            items.push({
                name: route.name,
                path: route.path
            })
        }
        if (route.children) {
            items.push(...generateMenuItems(route.children))
        }
    })
    return items
}

// 获取所有路由并生成菜单项
const menuItems = computed(() => generateMenuItems(router.options?.routes))

// 跳转到指定页面
const navigateTo = (path: string) => {
    router.push(path)
}
</script>

<style scoped>
.setting-box {
    position: fixed;
    right: 20px;
    top: 15px;
}
</style>