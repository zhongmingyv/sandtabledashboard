<script setup>
// 游戏数据版本：每次在「游戏版本」页上传整包，服务器都把里面的 data/ 单独打成一个 zip（战役包）存一份。
// 它给导出游戏联机（开桌钉住这一版）与 GM 审举报（下载那一局的数据）用；exe 自己升级下的仍是「游戏版本」里的整包。
// 换了新版，旧的那份进保留期（全局配置「旧版本几天后删除」），到期删包。这里只看、不传。
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../api/admin'
import { fmtBytes, fmtDate } from '../utils/format'

const loading = ref(false)
const rows = ref([])
const keepDays = ref(0)

const stateText = { current: '当前版本', retired: '已换下', deleted: '已删' }
const stateType = { current: 'success', retired: 'warning', deleted: 'info' }

// 按游戏分组，组内新版在前
const groups = computed(() => {
  const map = new Map()
  for (const r of rows.value) {
    if (!map.has(r.gameId)) map.set(r.gameId, [])
    map.get(r.gameId).push(r)
  }
  return [...map.entries()].map(([gameId, versions]) => ({
    gameId,
    title: versions[0].title,
    current: versions.find((v) => v.state === 'current') || null,
    versions,
  }))
})

async function load() {
  loading.value = true
  try {
    const res = await api.gameData()
    rows.value = res.items || []
    keepDays.value = res.keepDays || 0
  } finally {
    loading.value = false
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择')
  }
}

onMounted(load)
</script>

<template>
  <div>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
      <template #title>
        每次在「游戏版本」上传整包，服务器都把里面的 data/ 单独打成一个 zip 存一份：给导出游戏联机、GM 审举报用。
        玩家升级游戏下的仍是整包。换了新版，旧的那份保留 {{ keepDays }} 天后删除（全局配置「旧版本几天后删除」）。
      </template>
    </el-alert>

    <div class="page-toolbar">
      <div class="spacer" />
      <el-button @click="load">刷新</el-button>
    </div>

    <el-empty v-if="!loading && groups.length === 0" description="还没有游戏数据：先到「游戏版本」上传整包" />

    <el-card v-for="g in groups" :key="g.gameId" v-loading="loading" style="margin-bottom: 12px" shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
          <strong>{{ g.title }}</strong>
          <el-tag v-if="g.current" type="success">当前：第 {{ g.current.version }} 版</el-tag>
          <el-tag v-else type="warning">没有当前版本</el-tag>
          <span style="color: #909399; font-family: monospace">{{ g.gameId }}</span>
        </div>
      </template>
      <el-table
        :data="g.versions"
        border
        size="small"
        :row-style="({ row }) => (row.state === 'deleted' ? { color: '#a8abb2' } : {})"
      >
        <el-table-column label="版本" width="110">
          <template #default="{ row }">第 {{ row.version }} 版</template>
        </el-table-column>
        <el-table-column label="状态" width="200">
          <template #default="{ row }">
            <el-tag :type="stateType[row.state]" size="small">{{ stateText[row.state] || row.state }}</el-tag>
            <span v-if="row.deleteAfter" style="margin-left: 6px; color: #909399; font-size: 12px">
              {{ fmtDate(row.deleteAfter) }} 删
            </span>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="110">
          <template #default="{ row }">{{ fmtBytes(row.size) }}</template>
        </el-table-column>
        <el-table-column label="MD5" min-width="200">
          <template #default="{ row }">
            <span style="font-family: monospace; font-size: 12px" :title="row.md5">{{ row.md5 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="生成时间" width="170">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <template v-if="row.url">
              <el-link :href="row.url" type="primary" :underline="false">下载</el-link>
              <el-button link type="primary" style="margin-left: 8px" @click="copy(row.url)">复制地址</el-button>
            </template>
            <span v-else style="color: #c0c4cc">—</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
