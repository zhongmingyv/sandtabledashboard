<script setup>
// 后台发版的 Maker 插件：把插件的 build-plugin.ps1 打出来的 zip 传上来，先「待生效」，点「生效」才对 Maker 可见。
// 编号、版本、接口版本都从 zip 里的 plugin.json 读，不用填。没有审核，也没有强制升级：要不要更新由用户在 Maker 里决定。
// 插件的 plugin.json 把 updateUrl 填成这里复制的「更新地址」，Maker 才查得到新版。
// 「说明」显示在官网插件市场：第一次上传取 plugin.json 的 description，之后以这里编辑的为准，发新版不覆盖。
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { API_BASE } from '../config'
import { fmtBytes, fmtDate } from '../utils/format'

const ROOT = '/admin/plugin-releases'

const loading = ref(false)
const rows = ref([])
const descriptions = ref({})
// 正在编辑说明的插件；null = 没开对话框
const editing = ref(null)
const editText = ref('')
const editBusy = ref(false)
const uploading = ref(false)
const progress = ref(0)
// 进度条之外要显示的一句话（算校验值 / 服务器处理到哪一步）；空 = 正在传，显示进度条
const stage = ref('')
const fileInput = ref(null)
const lastResult = ref(null)
const lastError = ref('')

// 列表已按插件编号、新版在前排好，这里按编号分组
const groups = computed(() => {
  const map = new Map()
  for (const row of rows.value) {
    if (!map.has(row.pluginId)) map.set(row.pluginId, [])
    map.get(row.pluginId).push(row)
  }
  return [...map].map(([pluginId, items]) => ({
    pluginId,
    name: items[0].name,
    items,
    latest: items.find((r) => !r.archived && !r.pending) || null,
  }))
})

const updateUrl = (pluginId) => `${API_BASE.replace(/\/$/, '')}/plugins/${pluginId}/latest`

async function load() {
  loading.value = true
  try {
    const res = await api.pluginReleases()
    rows.value = res.items
    descriptions.value = res.descriptions || {}
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
  if (!/\.zip$/i.test(file.name)) {
    ElMessage.error('请选择 build-plugin.ps1 打出来的 zip')
    return
  }
  uploading.value = true
  progress.value = 0
  stage.value = ''
  lastResult.value = null
  lastError.value = ''
  try {
    lastResult.value = await api.uploadExeDirect(
      ROOT,
      file,
      (sent, total) => {
        progress.value = Math.floor((sent * 100) / total)
      },
      (s) => {
        stage.value = s
      },
    )
    load()
  } catch (err) {
    lastError.value = err?.response?.data?.message || err?.response?.data?.error || err?.message || '上传失败'
  } finally {
    uploading.value = false
    stage.value = ''
  }
}

function openEdit(group) {
  editText.value = descriptions.value[group.pluginId] || ''
  editing.value = group
}

async function saveDescription() {
  editBusy.value = true
  try {
    await api.savePluginDescription(editing.value.pluginId, editText.value)
    ElMessage.success('说明已保存，官网插件市场刷新后可见')
    editing.value = null
    load()
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || err?.response?.data?.error || '保存失败')
  } finally {
    editBusy.value = false
  }
}

async function activate(row) {
  try {
    await ElMessageBox.confirm(
      `让 ${row.name} ${row.version} 成为最新版？生效后 Maker 启动时会询问用户是否更新，比它旧的版本文件随即删掉。`,
      '生效',
      { type: 'info' },
    )
  } catch {
    return
  }
  try {
    await api.activatePluginRelease(row.pluginId, row.version)
    ElMessage.success(`${row.name} ${row.version} 已生效`)
    load()
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || err?.response?.data?.error || '生效失败')
  }
}

async function withdraw(row) {
  try {
    await ElMessageBox.confirm(
      `撤下 ${row.name} ${row.version}？文件删掉之后不会退回上一版，这个版本号也不能再用。`,
      '撤下版本',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await api.withdrawPluginRelease(row.pluginId, row.version)
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
        跑插件的 build-plugin.ps1 打包，把 dist 里的 zip 传到这里：浏览器直接传给 R2，不经服务器。编号、版本号从 plugin.json 读，不用填；
        版本号要比已有的新。传上来先「待生效」，点「生效」后 Maker 启动时询问用户是否更新。只保留生效的最新一版的文件。
        插件的 plugin.json 要把 updateUrl 填成下面的「更新地址」，Maker 才查得到新版。
      </template>
    </el-alert>

    <div class="page-toolbar">
      <input ref="fileInput" type="file" accept=".zip" style="display: none" @change="upload" />
      <el-button type="primary" :loading="uploading" @click="pick">上传插件</el-button>
      <el-progress v-if="uploading && !stage" :percentage="progress" style="width: 280px" />
      <span v-if="uploading && stage" style="color: #909399">{{ stage }}……</span>
      <div class="spacer" />
      <el-button @click="load">刷新</el-button>
    </div>

    <el-alert v-if="lastError" type="error" :title="lastError" show-icon style="margin-bottom: 12px" @close="lastError = ''" />
    <el-alert
      v-if="lastResult"
      type="success"
      :title="`${lastResult.name} ${lastResult.version}（${fmtBytes(lastResult.size)}）已传上去，待生效：在下面列表里点「生效」`"
      show-icon
      style="margin-bottom: 12px"
      @close="lastResult = null"
    />

    <el-card v-if="groups.length === 0" v-loading="loading" shadow="never">
      <el-empty :description="loading ? '加载中' : '还没有上传过插件'" />
    </el-card>

    <el-card v-for="g in groups" :key="g.pluginId" v-loading="loading" shadow="never" style="margin-bottom: 12px">
      <template #header>
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
          <strong>{{ g.name }}</strong>
          <span style="color: #909399; font-family: monospace">{{ g.pluginId }}</span>
          <el-tag v-if="g.latest" type="success">最新：{{ g.latest.version }}</el-tag>
          <el-tag v-else type="warning">暂无可下载的版本</el-tag>
          <div class="spacer" style="flex: 1" />
          <el-button link type="primary" @click="copy(updateUrl(g.pluginId))">复制更新地址</el-button>
        </div>
      </template>
      <div style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px">
        <div style="flex: 1; min-width: 0; white-space: pre-line; overflow-wrap: anywhere">
          <span v-if="descriptions[g.pluginId]">{{ descriptions[g.pluginId] }}</span>
          <span v-else style="color: #909399">还没有说明，官网插件市场会空着这一段</span>
        </div>
        <el-button link type="primary" @click="openEdit(g)">编辑说明</el-button>
      </div>
      <el-table :data="g.items" border size="small" :row-style="({ row }) => (row.archived ? { color: '#a8abb2' } : {})">
        <el-table-column label="版本" width="150">
          <template #default="{ row }">
            {{ row.version }}
            <el-tag v-if="row.archived" type="info" size="small">已清理</el-tag>
            <el-tag v-else-if="row.pending" type="warning" size="small">待生效</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="接口版本" width="90" prop="api" />
        <el-table-column label="下载次数" width="90" prop="downloadCount" />
        <el-table-column label="大小" width="110">
          <template #default="{ row }">{{ fmtBytes(row.size) }}</template>
        </el-table-column>
        <el-table-column label="更新说明" min-width="200" prop="notes" show-overflow-tooltip />
        <el-table-column label="SHA-256" width="170">
          <template #default="{ row }">
            <span style="font-family: monospace; font-size: 12px">{{ row.sha256.slice(0, 16) }}…</span>
          </template>
        </el-table-column>
        <el-table-column label="上传时间" width="170">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.pending && !row.archived" link type="primary" @click="activate(row)">生效</el-button>
            <el-button v-if="!row.archived" link type="danger" @click="withdraw(row)">撤下</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog :model-value="!!editing" :title="`编辑说明：${editing?.name || ''}`" width="560px" @close="editing = null">
      <el-input v-model="editText" type="textarea" :rows="8" maxlength="2000" show-word-limit placeholder="显示在官网插件市场，可以换行" />
      <template #footer>
        <el-button @click="editing = null">取消</el-button>
        <el-button type="primary" :loading="editBusy" @click="saveDescription">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
