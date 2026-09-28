<script setup>
// 游戏版本：编辑器「导出独立版」出来的游戏，整个目录打成 zip 传上来，就成为该游戏的最新版。
// 玩家打开游戏时问服务器「最新是几版」，比自己新就弹窗提示下载。
// 版本号与游戏身份都烙在包里的 data/server.json，服务器照读、这里不让填——
// 填的号与包里的不一致，玩家装完仍自认旧版，每次启动都要再下一遍。
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { API_BASE } from '../config'
import { fmtBytes, fmtDate } from '../utils/format'

const loading = ref(false)
const rows = ref([])
const uploading = ref(false)
const progress = ref(0)
const fileInput = ref(null)
const lastResult = ref(null)
const lastError = ref('')

// 按游戏分组，组内新版在前；每组第一行就是玩家会被推送的那一版
const groups = computed(() => {
  const map = new Map()
  for (const r of rows.value) {
    if (!map.has(r.gameId)) map.set(r.gameId, [])
    map.get(r.gameId).push(r)
  }
  return [...map.entries()].map(([gameId, versions]) => ({
    gameId,
    title: versions[0].title,
    latest: versions[0],
    versions,
  }))
})

function downloadUrl(gameId) {
  return `${API_BASE.replace(/\/+$/, '')}/games/${gameId}/download`
}

async function load() {
  loading.value = true
  try {
    rows.value = (await api.gameReleases()).items
  } finally {
    loading.value = false
  }
}

function pick() {
  fileInput.value.value = ''
  fileInput.value.click()
}

async function upload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.zip')) {
    ElMessage.error('请选择 zip 文件：导出的整个游戏目录（exe + data）打成的压缩包')
    return
  }
  uploading.value = true
  progress.value = 0
  lastResult.value = null
  lastError.value = ''
  try {
    const res = await api.uploadGamePackage(file, (sent, total) => {
      progress.value = Math.floor((sent * 100) / total)
    })
    lastResult.value = res
    ElMessage.success(`「${res.title}」第 ${res.version} 版已成为最新版`)
    load()
  } catch (err) {
    lastError.value = err?.response?.data?.message || err?.response?.data?.error || '上传失败'
  } finally {
    uploading.value = false
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `删除「${row.title}」第 ${row.version} 版？删的若是最新版，上一版会重新成为最新版。`,
      '删除版本',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await api.deleteGameRelease(row.gameId, row.version)
  ElMessage.success('已删除')
  load()
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

onMounted(load)
</script>

<template>
  <div>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
      <template #title>
        在编辑器「导出独立版」时填好服务器地址与版本号（可勾「同时打一个 zip」），把 zip 传到这里就成为该游戏的最新版。
        版本号从包里读，不用填；比已有最新版还旧的包会被拒。玩家打开旧版游戏时会提示下载。
      </template>
    </el-alert>

    <div class="page-toolbar">
      <input ref="fileInput" type="file" accept=".zip" style="display: none" @change="upload" />
      <el-button type="primary" :loading="uploading" @click="pick">上传新版本</el-button>
      <el-progress
        v-if="uploading"
        :percentage="progress"
        style="width: 280px"
      />
      <div class="spacer" />
      <el-button @click="load">刷新</el-button>
    </div>

    <el-alert
      v-if="lastError"
      type="error"
      :title="lastError"
      show-icon
      style="margin-bottom: 12px"
      @close="lastError = ''"
    />
    <el-alert
      v-if="lastResult"
      type="success"
      :title="`「${lastResult.title}」第 ${lastResult.version} 版（${fmtBytes(lastResult.size)}）已成为最新版`"
      show-icon
      style="margin-bottom: 12px"
      @close="lastResult = null"
    />

    <el-empty v-if="!loading && groups.length === 0" description="还没有上传过游戏" />

    <el-card v-for="g in groups" :key="g.gameId" v-loading="loading" style="margin-bottom: 12px" shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
          <strong>{{ g.title }}</strong>
          <el-tag type="success">最新：第 {{ g.latest.version }} 版</el-tag>
          <span style="color: #909399; font-family: monospace">{{ g.gameId }}</span>
          <div class="spacer" style="flex: 1" />
          <el-button link type="primary" @click="copy(downloadUrl(g.gameId))">复制下载地址</el-button>
        </div>
      </template>
      <el-table :data="g.versions" border size="small">
        <el-table-column prop="version" label="版本" width="90">
          <template #default="{ row }">第 {{ row.version }} 版</template>
        </el-table-column>
        <el-table-column label="大小" width="120">
          <template #default="{ row }">{{ fmtBytes(row.size) }}</template>
        </el-table-column>
        <el-table-column label="SHA-256" min-width="200">
          <template #default="{ row }">
            <span style="font-family: monospace; font-size: 12px">{{ row.sha256.slice(0, 16) }}…</span>
          </template>
        </el-table-column>
        <el-table-column label="上传时间" width="170">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
