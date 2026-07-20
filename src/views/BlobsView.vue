<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture, Headset, CopyDocument } from '@element-plus/icons-vue'
import { api } from '../api/admin'
import { fmtBytes, fmtDate } from '../utils/format'
import { PAGE_SIZE } from '../config'

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const layerTypes = ['background', 'height', 'terrain', 'edge', 'road', 'object', 'ui']

const query = reactive({
  kind: 'all',
  layer: '',
  status: 'all',
  q: '',
  sort: 'createdAt',
  order: 'desc',
  page: 1,
})

// sha -> object URL 缓存（缩略图 / 音频）
const thumbUrls = reactive({})
const audioUrls = reactive({})
// sha -> 加载状态：'loading' | 'error'（成功后转为 URL，删除该键）
const thumbState = reactive({})
const audioState = reactive({})

function isImage(row) {
  return String(row.mediaType || '').startsWith('image/')
}
function isAudio(row) {
  return String(row.mediaType || '').startsWith('audio/')
}

function parseLayers(row) {
  try {
    const arr = JSON.parse(row.layersJson || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function shortSha(sha) {
  return sha ? String(sha).slice(0, 12) : '-'
}

function revokeAll() {
  for (const k of Object.keys(thumbUrls)) {
    URL.revokeObjectURL(thumbUrls[k])
    delete thumbUrls[k]
  }
  for (const k of Object.keys(audioUrls)) {
    URL.revokeObjectURL(audioUrls[k])
    delete audioUrls[k]
  }
}

async function loadThumb(sha) {
  if (thumbUrls[sha] || thumbState[sha] === 'loading') return
  thumbState[sha] = 'loading'
  try {
    const res = await api.blobThumb(sha)
    if (!res?.data || res.data.size === 0) {
      thumbState[sha] = 'error'
      return
    }
    thumbUrls[sha] = URL.createObjectURL(res.data)
    delete thumbState[sha]
  } catch {
    thumbState[sha] = 'error'
  }
}

async function loadAudio(sha) {
  if (audioUrls[sha] || audioState[sha] === 'loading') return
  audioState[sha] = 'loading'
  try {
    const res = await api.blobRaw(sha)
    if (!res?.data || res.data.size === 0) {
      audioState[sha] = 'error'
      return
    }
    audioUrls[sha] = URL.createObjectURL(res.data)
    delete audioState[sha]
  } catch {
    audioState[sha] = 'error'
  }
}

async function load() {
  loading.value = true
  try {
    revokeAll()
    const res = await api.listBlobs({ ...query })
    rows.value = res.items || []
    total.value = res.total || 0
    // 预取图片缩略图（音频改为按需「试听」）
    for (const row of rows.value) {
      if (isImage(row)) loadThumb(row.sha256)
    }
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  load()
}

function reset() {
  query.kind = 'all'
  query.layer = ''
  query.status = 'all'
  query.q = ''
  query.page = 1
  load()
}

function onSort({ prop, order }) {
  if (!order) return
  query.sort = prop
  query.order = order === 'ascending' ? 'asc' : 'desc'
  load()
}

async function copySha(sha) {
  try {
    await navigator.clipboard.writeText(sha)
    ElMessage.success('已复制 sha256')
  } catch {
    ElMessage.warning('复制失败')
  }
}

async function toggleBan(row) {
  const banning = !row.isBanned
  try {
    await ElMessageBox.confirm(
      banning
        ? `封禁「${shortSha(row.sha256)}…」？所有人将无法下载该图/音频，可随时解封。`
        : `解封「${shortSha(row.sha256)}…」？`,
      banning ? '封禁 blob' : '解封 blob',
      { type: 'warning' },
    )
  } catch {
    return
  }
  banning ? await api.banBlob(row.sha256) : await api.unbanBlob(row.sha256)
  row.isBanned = banning
  ElMessage.success(banning ? '已封禁' : '已解封')
}

async function hardDelete(row) {
  try {
    await ElMessageBox.confirm(
      '硬删除会物理删文件并回收空间；若该图仍被战役/资源引用会留下空引用，确定？',
      '硬删除（不可逆）',
      { type: 'error', confirmButtonText: '确认删除', confirmButtonClass: 'el-button--danger' },
    )
  } catch {
    return
  }
  const res = await api.deleteBlob(row.sha256)
  ElMessage.success(`已删除，回收 ${fmtBytes(res?.freedBytes || 0)}`)
  load()
}

onMounted(load)
onUnmounted(revokeAll)
</script>

<template>
  <div>
    <div class="page-toolbar">
      <el-select v-model="query.kind" style="width: 120px" @change="search">
        <el-option label="全部" value="all" />
        <el-option label="图片" value="image" />
        <el-option label="音频" value="audio" />
      </el-select>
      <el-select v-model="query.layer" placeholder="图层" clearable style="width: 130px" @change="search">
        <el-option label="全部图层" value="" />
        <el-option v-for="l in layerTypes" :key="l" :label="l" :value="l" />
      </el-select>
      <el-select v-model="query.status" style="width: 120px" @change="search">
        <el-option label="全部" value="all" />
        <el-option label="正常" value="active" />
        <el-option label="已封禁" value="banned" />
      </el-select>
      <el-input v-model="query.q" placeholder="sha256 前缀" clearable style="width: 200px" @keyup.enter="search" @clear="search" />
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="reset">重置</el-button>
      <div class="spacer" />
      <span style="color: #909399">共 {{ total }} 条</span>
    </div>

    <el-table :data="rows" v-loading="loading" @sort-change="onSort" border>
      <el-table-column label="预览" width="150">
        <template #default="{ row }">
          <!-- 图片：缩略图 -->
          <template v-if="isImage(row)">
            <el-image
              v-if="thumbUrls[row.sha256]"
              :src="thumbUrls[row.sha256]"
              fit="contain"
              style="width: 64px; height: 64px; background: #f0f2f5; border-radius: 4px"
              :preview-src-list="[thumbUrls[row.sha256]]"
              hide-on-click-modal
              preview-teleported
            />
            <div v-else class="preview-ph">
              <el-icon><Picture /></el-icon>
              <span>{{ thumbState[row.sha256] === 'loading' ? '加载中' : row.mediaType }}</span>
            </div>
          </template>
          <!-- 音频：按需试听 -->
          <template v-else-if="isAudio(row)">
            <audio v-if="audioUrls[row.sha256]" :src="audioUrls[row.sha256]" controls preload="none" style="width: 130px" />
            <el-button v-else link type="primary" :loading="audioState[row.sha256] === 'loading'" @click="loadAudio(row.sha256)">
              <el-icon style="margin-right: 4px"><Headset /></el-icon>
              {{ audioState[row.sha256] === 'error' ? '无法试听' : '试听' }}
            </el-button>
          </template>
          <div v-else class="preview-ph"><span>{{ row.mediaType || '-' }}</span></div>
        </template>
      </el-table-column>

      <el-table-column label="sha256" min-width="150">
        <template #default="{ row }">
          <el-tooltip :content="row.sha256" placement="top">
            <span style="font-family: monospace; cursor: pointer" @click="copySha(row.sha256)">
              {{ shortSha(row.sha256) }}…
              <el-icon style="vertical-align: -2px; color: #909399"><CopyDocument /></el-icon>
            </span>
          </el-tooltip>
        </template>
      </el-table-column>

      <el-table-column prop="mediaType" label="类型" width="110" />
      <el-table-column label="尺寸" width="100">
        <template #default="{ row }">{{ row.width && row.height ? `${row.width}×${row.height}` : '-' }}</template>
      </el-table-column>
      <el-table-column prop="size" label="大小" width="100" sortable="custom">
        <template #default="{ row }">{{ fmtBytes(row.size) }}</template>
      </el-table-column>
      <el-table-column prop="refCount" label="引用数" width="90" sortable="custom" />
      <el-table-column label="图层" min-width="140">
        <template #default="{ row }">
          <template v-if="parseLayers(row).length">
            <el-tag v-for="l in parseLayers(row)" :key="l" size="small" style="margin: 0 4px 4px 0">{{ l }}</el-tag>
          </template>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="首传者" width="120">
        <template #default="{ row }">{{ row.ownerName || '-' }}</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="首传时间" width="150" sortable="custom">
        <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag v-if="row.isBanned" type="danger" size="small">已封禁</el-tag>
          <el-tag v-else type="success" size="small">正常</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link :type="row.isBanned ? 'success' : 'warning'" @click="toggleBan(row)">
            {{ row.isBanned ? '解封' : '封禁' }}
          </el-button>
          <el-button link type="danger" @click="hardDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination layout="prev, pager, next" :total="total" :page-size="PAGE_SIZE" :current-page="query.page" @current-change="(p) => { query.page = p; load() }" />
    </div>
  </div>
</template>

<style scoped>
.preview-ph {
  width: 64px;
  height: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: #f0f2f5;
  border-radius: 4px;
  color: #909399;
  font-size: 11px;
  text-align: center;
  padding: 2px;
  word-break: break-all;
}
.preview-ph .el-icon {
  font-size: 20px;
}
</style>
