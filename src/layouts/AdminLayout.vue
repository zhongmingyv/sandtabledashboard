<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../store/auth'
import { api } from '../api/admin'
import { USE_MOCK, API_BASE } from '../config'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const activeMenu = computed(() => route.name)

const menus = [
  { name: 'overview', title: '概览', icon: 'DataLine' },
  { name: 'users', title: '用户管理', icon: 'User' },
  { name: 'campaigns', title: '战役管理', icon: 'Files' },
  { name: 'blobs', title: '图床管理', icon: 'Picture' },
  { name: 'replays', title: '复盘管理', icon: 'VideoPlay' },
  { name: 'settings', title: '全局配置', icon: 'Setting' },
  { name: 'audit', title: '操作审计', icon: 'Document' },
  { name: 'login-logs', title: '登录日志', icon: 'List' },
]

async function logout() {
  try {
    await api.logout()
  } catch {
    /* 忽略 */
  }
  auth.clear()
  router.push({ name: 'login' })
}
</script>

<template>
  <el-container style="height: 100%">
    <el-aside width="200px" style="background: #001529">
      <div style="color: #fff; font-size: 16px; font-weight: 600; padding: 18px 20px">
        SLGM 运营后台
      </div>
      <el-menu
        :default-active="activeMenu"
        background-color="#001529"
        text-color="#c0c4cc"
        active-text-color="#409eff"
        router
      >
        <el-menu-item v-for="m in menus" :key="m.name" :index="m.name" :route="{ name: m.name }">
          <el-icon><component :is="m.icon" /></el-icon>
          <span>{{ m.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fff;
          border-bottom: 1px solid #eee;
        "
      >
        <div style="font-size: 16px">{{ route.meta.title || '' }}</div>
        <div style="display: flex; align-items: center; gap: 16px">
          <el-tag v-if="USE_MOCK" type="warning" size="small">MOCK 模式 · 未接后端</el-tag>
          <el-tag v-else type="success" size="small">{{ API_BASE }}</el-tag>
          <span style="color: #666">{{ auth.username || 'admin' }}</span>
          <el-button link type="primary" @click="router.push({ name: 'change-password' })">修改密码</el-button>
          <el-button link type="primary" @click="logout">退出</el-button>
        </div>
      </el-header>
      <el-main style="background: #f5f7fa">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>
