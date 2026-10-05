<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture, Headset, VideoPlay } from '@element-plus/icons-vue'
import { api } from '../api/admin'
import { fmtBytes, fmtDate } from '../utils/format'
import { PAGE_SIZE } from '../config'

// 资源库审核（ADR-0016）：作者发布战役时勾选分享的素材，每条分享一行（同一张图可以被好几个人各分享一条）。
// 放行 / 驳回只管这一条；「封禁素材」按文件内容封，所有指向它的分享一起下架、以后也不能再传。

const loading = ref(false)
const rows = ref([])
const total = ref(0)

const query = reactive({ status: 'pending', kind: '', layer: '', q: '', page: 1 })

const kinds = { image: '图片', sound: '声音', music: '音乐', video: '视频' }
const layers = {
  background: '背景', height: '高度', terrain: '地形', edge: '边', road: '路', object: '对象',
  region: '区域', ui: 'UI', effect: '特效', other: '其它',
}
const modes = { image: '图片', random: '随机', chain: '接龙', connect: '连接件', anim: '序列帧', water: '水面' }
const statusText = { pending: '待审', approved: '已上架', rejected: '被拒' }
const statusType = { pending: 'warning', approved: 'success', rejected: 'info' }

// 点过「试听 / 播放」才挂播放器，免得一进页面就连一串文件地址
const mediaOn = reactive({})
const thumbError = reactive({})

function usageText(u) {
  let t = layers[u.layer] || u.layer
  if (u.mode) t += '·' + (modes[u.mode] || u.mode)
  if (u.ui) t += '·' + u.ui
  return t
}

async function load() {
  loading.value = true
  try {
    const res = await api.library({ ...query })
    rows.value = res.items || []
    total.value = res.total || 0
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  load()
}

async function approve(row) {
  await api.approveLibrary(row.id)
  ElMessage.success(`已放行：${row.name}`)
  load()
}

async function reject(row) {
  let reason
  try {
    ;({ value: reason } = await ElMessageBox.prompt('驳回理由（作者在「我的分享」里看得到）', `驳回「${row.name}」`, {
      inputValidator: (v) => (v || '').length <= 500 || '最多 500 字',
    }))
  } catch {
    return
  }
  await api.rejectLibrary(row.id, reason || '')
  ElMessage.success(`已驳回：${row.name}`)
  load()
}

async function banAsset(row) {
  try {
    await ElMessageBox.confirm(
      `按文件内容封禁「${row.name}」？文件立刻删除，资源库里所有指向这张图的分享一起下架，用到它的战役里也会缺这张图，以后谁都不能再传同样的文件。`,
      '封禁素材（违规内容）',
      { type: 'error', confirmButtonText: '封禁', confirmButtonClass: 'el-button--danger' },
    )
  } catch {
    return
  }
  await api.banCampaignAsset(row.sha256)
  ElMessage.success('已封禁')
  load()
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-toolbar">
      <el-select v-model="query.status" style="width: 110px" @change="search">
        <el-option label="待审" value="pending" />
        <el-option label="已上架" value="approved" />
        <el-option label="被拒" value="rejected" />
        <el-option label="全部" value="all" />
      </el-select>
      <el-select v-model="query.kind" style="width: 110px" @change="search">
        <el-option label="全部类型" value="" />
        <el-option v-for="(label, k) in kinds" :key="k" :label="label" :value="k" />
      </el-select>
      <el-select v-model="query.layer" style="width: 110px" @change="search">
        <el-option label="全部层" value="" />
        <el-option v-for="(label, k) in layers" :key="k" :label="label" :value="k" />
      </el-select>
      <el-input v-model="query.q" placeholder="名字" clearable style="width: 180px" @keyup.enter="search" @clear="search" />
      <el-button type="primary" @click="search">查询</el-button>
      <div class="spacer" />
      <span style="color: #909399">共 {{ total }} 条</span>
    </div>

    <el-table :data="rows" v-loading="loading" border>
      <el-table-column label="预览" width="150">
        <template #default="{ row }">
          <template v-if="row.kind === 'image'">
            <el-image
              v-if="!thumbError[row.id]"
              :src="row.thumbUrl || row.url"
              fit="contain"
              style="width: 64px; height: 64px; background: #f0f2f5; border-radius: 4px"
              :preview-src-list="[row.url]"
              hide-on-click-modal
              preview-teleported
              @error="thumbError[row.id] = true"
            />
            <div v-else class="preview-ph"><el-icon><Picture /></el-icon><span>文件已删</span></div>
          </template>
          <template v-else-if="row.kind === 'video'">
            <video v-if="mediaOn[row.id]" :src="row.url" controls autoplay style="width: 130px" />
            <el-button v-else link type="primary" @click="mediaOn[row.id] = true">
              <el-icon style="margin-right: 4px"><VideoPlay /></el-icon>播放
            </el-button>
          </template>
          <template v-else>
            <audio v-if="mediaOn[row.id]" :src="row.url" controls autoplay style="width: 130px" />
            <el-button v-else link type="primary" @click="mediaOn[row.id] = true">
              <el-icon style="margin-right: 4px"><Headset /></el-icon>试听
            </el-button>
          </template>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名字" min-width="140" />
      <el-table-column label="类型" width="80">
        <template #default="{ row }">{{ kinds[row.kind] || row.kind }}{{ row.hasGrid ? '（已切格）' : '' }}</template>
      </el-table-column>
      <el-table-column label="尺寸" width="90">
        <template #default="{ row }">{{ row.width ? `${row.width}×${row.height}` : '-' }}</template>
      </el-table-column>
      <el-table-column label="大小" width="90">
        <template #default="{ row }">{{ fmtBytes(row.size) }}</template>
      </el-table-column>
      <el-table-column label="用法" min-width="160">
        <template #default="{ row }">
          <el-tag v-for="(u, i) in row.usages" :key="i" size="small" style="margin: 0 4px 4px 0">{{ usageText(u) }}</el-tag>
          <span v-if="!row.usages?.length">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="ownerName" label="分享者" width="110" />
      <el-table-column label="分享时间" width="150">
        <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column prop="downloadCount" label="下载" width="70" />
      <el-table-column label="状态" width="130">
        <template #default="{ row }">
          <el-tag :type="statusType[row.status]" size="small">{{ statusText[row.status] || row.status }}</el-tag>
          <el-tag v-if="row.status === 'pending' && row.sameShaApproved" type="success" size="small" style="margin-left: 4px">同图已审</el-tag>
          <div v-if="row.rejectReason" style="color: #909399; font-size: 12px">{{ row.rejectReason }}</div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <el-button link type="success" :disabled="row.status === 'approved'" @click="approve(row)">放行</el-button>
          <el-button link type="warning" :disabled="row.status === 'rejected'" @click="reject(row)">驳回</el-button>
          <el-button link type="danger" @click="banAsset(row)">封禁素材</el-button>
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
}
</style>
