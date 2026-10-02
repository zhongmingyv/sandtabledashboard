<script setup>
// Maker 版本：property-editor/build/release.bat 打出来的 SandTableClub.exe 传上来，就成为 Maker 的最新版。
// Maker 每次打开问服务器「最新是几版」，比自己新就后台下载、下次启动换上。
// 版本号由发版脚本烙进 exe 的文件版本，服务器照读、这里不让填——填错了玩家装完仍自认旧版，每次启动都要再下一遍。
// 「强制升级」就是全局配置里的「Maker 最低版本」：低于它的 Maker 一打开就被拦住，下完新版自动重启。
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { fmtBytes, fmtDate } from '../utils/format'

const MIN_KEY = 'client.minMakerVersion'

const loading = ref(false)
const rows = ref([])
const minVersion = ref(0)
const uploading = ref(false)
const progress = ref(0)
// 传完之后服务器登记的阶段（空 = 还在传）
const stage = ref('')
const fileInput = ref(null)
const forced = ref(false)
const lastResult = ref(null)
const lastError = ref('')

const latest = () => rows.value.find((r) => !r.archived) || null

async function load() {
  loading.value = true
  try {
    const res = await api.makerReleases()
    rows.value = res.items
    minVersion.value = res.minVersion || 0
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
  if (!file.name.toLowerCase().endsWith('.exe')) {
    ElMessage.error('请选择 release.bat 打出来的 SandTableClub.exe')
    return
  }
  uploading.value = true
  progress.value = 0
  stage.value = ''
  lastResult.value = null
  lastError.value = ''
  try {
    const res = await api.uploadMakerExe(
      file,
      forced.value,
      (sent, total) => {
        progress.value = Math.floor((sent * 100) / total)
      },
      (s) => {
        stage.value = s || '处理中'
      },
    )
    lastResult.value = res
    ElMessage.success(`Maker 第 ${res.version} 版已成为最新版${forced.value ? '，并设为强制升级' : ''}`)
    forced.value = false
    load()
  } catch (err) {
    lastError.value = err?.response?.data?.message || err?.response?.data?.error || '上传失败'
  } finally {
    uploading.value = false
    stage.value = ''
  }
}

// 改「强制升级到第几版」：与全局配置页的「Maker 最低版本」是同一项
async function setMinVersion(version) {
  try {
    await ElMessageBox.confirm(
      version
        ? `低于第 ${version} 版的 Maker 一打开就会被拦住，必须下完新版才能继续用；联机开桌 / 加入也会被拦。继续？`
        : '取消强制后，旧版 Maker 照常能用（仍会在后台下载新版、下次启动换上）。继续？',
      version ? '强制升级' : '取消强制',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await api.saveSettings({ [MIN_KEY]: version ? String(version) : '' })
  ElMessage.success('已保存')
  load()
}

async function withdraw(row) {
  try {
    await ElMessageBox.confirm(
      `撤下第 ${row.version} 版？文件删掉之后 Maker 暂时没有可下载的版本（不会退回上一版），这个版本号也不能再用。`,
      '撤下版本',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await api.withdrawMakerRelease(row.version)
  ElMessage.success('已撤下')
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
        跑 property-editor/build/release.bat 出包（版本号自动加 1），把 build/SandTableClub.exe 传到这里就成为 Maker 的最新版。
        版本号从 exe 里读，不用填；不比已有版本新的会被拒。Maker 打开时自动在后台下载、下次启动换上。
        只保留最新一版的文件。勾「强制升级」= 低于这一版的 Maker 一打开就被拦住、必须更新（就是全局配置里的「Maker 最低版本」）。
      </template>
    </el-alert>

    <div class="page-toolbar">
      <input ref="fileInput" type="file" accept=".exe" style="display: none" @change="upload" />
      <el-checkbox v-model="forced" :disabled="uploading">强制升级</el-checkbox>
      <el-button type="primary" :loading="uploading" @click="pick">上传新版本</el-button>
      <el-progress v-if="uploading && !stage" :percentage="progress" style="width: 280px" />
      <span v-if="uploading && stage" style="color: #909399">已传完，服务器正在处理：{{ stage }}……</span>
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
      :title="`Maker 第 ${lastResult.version} 版（${fmtBytes(lastResult.size)}）已成为最新版`"
      show-icon
      style="margin-bottom: 12px"
      @close="lastResult = null"
    />

    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
          <el-tag v-if="latest()" type="success">最新：第 {{ latest().version }} 版</el-tag>
          <el-tag v-else type="warning">暂无可下载的版本</el-tag>
          <el-tag v-if="minVersion" type="danger">强制升级到第 {{ minVersion }} 版</el-tag>
          <el-tag v-else type="info">不强制</el-tag>
          <el-button
            v-if="latest() && minVersion !== latest().version"
            size="small"
            type="danger"
            plain
            @click="setMinVersion(latest().version)"
          >
            强制升级到第 {{ latest().version }} 版
          </el-button>
          <el-button v-if="minVersion" size="small" @click="setMinVersion(0)">取消强制</el-button>
          <div class="spacer" style="flex: 1" />
          <el-button link type="primary" :disabled="!latest()?.url" @click="copy(latest().url)">复制下载地址</el-button>
        </div>
      </template>
      <el-empty v-if="!loading && rows.length === 0" description="还没有上传过 Maker" />
      <el-table
        v-else
        :data="rows"
        border
        size="small"
        :row-style="({ row }) => (row.archived ? { color: '#a8abb2' } : {})"
      >
        <el-table-column label="版本" width="150">
          <template #default="{ row }">
            第 {{ row.version }} 版
            <el-tag v-if="row.archived" type="info" size="small">已清理</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="下载次数" width="110">
          <template #default="{ row }">{{ row.downloadCount || 0 }}</template>
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
            <el-button v-if="!row.archived" link type="danger" @click="withdraw(row)">撤下</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
