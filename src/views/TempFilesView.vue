<script setup>
// 临时文件：随手发给别人的文件（不进版本流程的游戏包、说明书……）。传上去拿一条链接，对方不用登录就能下。
// 与「游戏版本」「Maker 版本」完全无关：不登记版本，任何客户端查新都看不到它。
// 可以设到期日期，也可以永久；到期那一刻链接就失效，文件由服务器每天回收时删掉。随时可以手动删。
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { API_BASE } from '../config'
import { fmtBytes, fmtDate } from '../utils/format'

const DEFAULT_DAYS = 30

const loading = ref(false)
const rows = ref([])
const fileInput = ref(null)
const uploading = ref(false)
const progress = ref(0)
const stage = ref('')
const lastError = ref('')

// 上传前填的：说明 + 过期方式
const note = ref('')
const forever = ref(false)
const expireDay = ref(daysFromToday(DEFAULT_DAYS))

// 「修改」对话框
const editing = ref(null)
const editNote = ref('')
const editForever = ref(false)
const editDay = ref(null)
const editBusy = ref(false)

function daysFromToday(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

// 选的是哪一天，就到那天本地时间结束为止
function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString()
}

function beforeToday(d) {
  const t = new Date()
  return d < new Date(t.getFullYear(), t.getMonth(), t.getDate())
}

const fullLink = (row) => API_BASE.replace(/\/$/, '') + row.link

async function load() {
  loading.value = true
  try {
    rows.value = (await api.tempFiles()).items
  } finally {
    loading.value = false
  }
}

function pick() {
  if (!forever.value && !expireDay.value) {
    ElMessage.error('请选到期日期，或者勾「永久」')
    return
  }
  fileInput.value.value = ''
  fileInput.value.click()
}

async function upload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  uploading.value = true
  progress.value = 0
  stage.value = ''
  lastError.value = ''
  try {
    const res = await api.uploadTempFile(
      file,
      note.value,
      forever.value ? null : endOfDay(expireDay.value),
      (sent, total) => {
        progress.value = Math.floor((sent * 100) / total)
      },
      (s) => {
        stage.value = s
      },
    )
    note.value = ''
    ElMessage.success(`「${res.file.name}」已传上去，链接在列表里`)
    load()
  } catch (err) {
    lastError.value = err?.response?.data?.message || err?.response?.data?.error || err?.message || '上传失败'
  } finally {
    uploading.value = false
    stage.value = ''
  }
}

function openEdit(row) {
  editing.value = row
  editNote.value = row.note
  editForever.value = !row.expiresAt
  editDay.value = row.expiresAt && !row.expired ? new Date(row.expiresAt) : daysFromToday(DEFAULT_DAYS)
}

async function saveEdit() {
  if (!editForever.value && !editDay.value) {
    ElMessage.error('请选到期日期，或者勾「永久」')
    return
  }
  editBusy.value = true
  try {
    await api.updateTempFile(editing.value.id, editNote.value, editForever.value ? null : endOfDay(editDay.value))
    ElMessage.success('已保存')
    editing.value = null
    load()
  } finally {
    editBusy.value = false
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`删掉「${row.name}」？链接马上失效，文件一起删掉，不能恢复。`, '删除', { type: 'warning' })
  } catch {
    return
  }
  await api.deleteTempFile(row.id)
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

load()
</script>

<template>
  <div>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
      <template #title>
        随手发给别人的文件放这里：传上去拿一条链接，对方不用登录就能下。和「游戏版本」「Maker 版本」无关，不会让任何客户端提示更新。
        可以设到期日期（到那天结束链接就失效，文件随后自动删掉），也可以永久；随时可以手动删。浏览器直接传给 R2，不经服务器。
      </template>
    </el-alert>

    <div class="page-toolbar" style="flex-wrap: wrap; gap: 8px">
      <el-input v-model="note" placeholder="说明（可不填），如：戎机 v70 邮箱版" style="width: 280px" :disabled="uploading" />
      <el-checkbox v-model="forever" :disabled="uploading">永久</el-checkbox>
      <el-date-picker
        v-if="!forever"
        v-model="expireDay"
        type="date"
        placeholder="到期日期"
        :disabled-date="beforeToday"
        :clearable="false"
        :disabled="uploading"
        style="width: 160px"
      />
      <input ref="fileInput" type="file" style="display: none" @change="upload" />
      <el-button type="primary" :loading="uploading" @click="pick">选择文件并上传</el-button>
      <el-progress v-if="uploading && !stage" :percentage="progress" style="width: 240px" />
      <span v-if="uploading && stage" style="color: #909399">{{ stage }}……</span>
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

    <el-card v-loading="loading" shadow="never">
      <el-empty v-if="!loading && rows.length === 0" description="还没有临时文件" />
      <el-table
        v-else
        :data="rows"
        border
        size="small"
        :row-style="({ row }) => (row.expired ? { color: '#a8abb2' } : {})"
      >
        <el-table-column label="文件" min-width="200">
          <template #default="{ row }">
            <div>{{ row.name }}</div>
            <div v-if="row.note" style="color: #909399; font-size: 12px">{{ row.note }}</div>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="110">
          <template #default="{ row }">{{ fmtBytes(row.size) }}</template>
        </el-table-column>
        <el-table-column label="下载次数" width="90">
          <template #default="{ row }">{{ row.downloadCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="上传时间" width="150">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="到期" width="170">
          <template #default="{ row }">
            <el-tag v-if="!row.expiresAt" type="success" size="small">永久</el-tag>
            <el-tag v-else-if="row.expired" type="info" size="small">已过期，等待删除</el-tag>
            <span v-else>{{ fmtDate(row.expiresAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="链接" min-width="220">
          <template #default="{ row }">
            <span v-if="row.expired" style="color: #a8abb2">已失效</span>
            <template v-else>
              <span style="font-family: monospace; font-size: 12px; word-break: break-all">{{ fullLink(row) }}</span>
              <el-button link type="primary" @click="copy(fullLink(row))">复制</el-button>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">修改</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog :model-value="!!editing" title="修改" width="440px" @close="editing = null">
      <template v-if="editing">
        <p style="margin-top: 0">{{ editing.name }}</p>
        <el-input v-model="editNote" placeholder="说明" style="margin-bottom: 12px" />
        <div style="display: flex; align-items: center; gap: 12px">
          <el-checkbox v-model="editForever">永久</el-checkbox>
          <el-date-picker
            v-if="!editForever"
            v-model="editDay"
            type="date"
            placeholder="到期日期"
            :disabled-date="beforeToday"
            :clearable="false"
            style="width: 160px"
          />
        </div>
      </template>
      <template #footer>
        <el-button @click="editing = null">取消</el-button>
        <el-button type="primary" :loading="editBusy" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
