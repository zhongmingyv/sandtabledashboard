<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api/admin'
import { fmtBytes } from '../utils/format'

const data = ref(null)
const loading = ref(false)

const cards = ref([])

async function load() {
  loading.value = true
  try {
    data.value = await api.overview()
    cards.value = [
      { label: '注册用户', value: data.value.userCount, sub: `封禁 ${data.value.bannedUserCount}` },
      { label: '战役（活）', value: data.value.campaignCount },
      { label: '资源（活）', value: data.value.resourceCount },
      { label: '复盘', value: data.value.replayCount },
      { label: '磁盘占用（估）', value: fmtBytes(data.value.diskBytes) },
    ]
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <el-row :gutter="16">
      <el-col v-for="c in cards" :key="c.label" :span="Math.floor(24 / (cards.length || 1))">
        <el-card shadow="hover">
          <div style="color: #909399; font-size: 13px">{{ c.label }}</div>
          <div style="font-size: 26px; font-weight: 600; margin-top: 8px">{{ c.value }}</div>
          <div v-if="c.sub" style="color: #c0c4cc; font-size: 12px; margin-top: 4px">{{ c.sub }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
