<script setup>
// 素材管理：作者发布战役时传上来的素材（R2 上按内容哈希一份，同一张图被多个战役用到只存一份）。
// 看每个文件被哪些战役用到、有没有分享到资源库；按文件封禁 = 文件当场删，所有用到它的战役里它一起消失、资源库里指向它的分享一起下架。
// 解封 = 撤掉墓碑：文件已经删了不会回来，作者重新发布时补传。取代老图床管理页（老图床 2026-10-13 整个拆掉）。
// 注意这里是「所有战役用到的文件」，比 Maker 资源商店多得多：商店只有作者勾选分享、且审核通过（资源库已上架）的那些。
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture, Headset, VideoPlay } from '@element-plus/icons-vue'
import { api } from '../api/admin'
import { fmtBytes, fmtDate } from '../utils/format'
import { PAGE_SIZE } from '../config'

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({ kind: '', status: '', q: '', sort: 'createdAt', order: 'desc', page: 1 })
const selected = ref([])
const acting = ref(false)

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp']
const VIDEO_EXT = ['.ogv', '.mp4', '.webm']
const revisionStatus = { pending: '待审', approved: '已通过', rejected: '被拒' }
const shareStatus = { pending: '待审', approved: '已上架', rejected: '被拒' }
const shareType = { pending: 'warning', approved: 'success', rejected: 'info' }

// 点过「试听 / 播放」才挂播放器，免得一进页面就连一串文件地址
const mediaOn = reactive({})
const thumbError = reactive({})

const drawer = ref(false)
const detail = ref(null)
const detailRow = ref(null)
const detailLoading = ref(false)

function kindOf(row) {
  if (IMAGE_EXT.includes(row.ext)) return 'image'
  if (VIDEO_EXT.includes(row.ext)) return 'video'
  return 'audio'
}

async function load() {
  loading.value = true
  selected.value = []
  try {
    const res = await api.campaignAssets({ ...query })
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

function onSort({ prop, order }) {
  query.sort = order ? prop : 'createdAt'
  query.order = order === 'ascending' ? 'asc' : 'desc'
  search()
}

async function open(row, column) {
  if (column?.type === 'selection') return // 点勾选框不开详情
  drawer.value = true
  detail.value = null
  detailRow.value = row
  detailLoading.value = true
  try {
    detail.value = await api.campaignAsset(row.sha256)
  } finally {
    detailLoading.value = false
  }
}

async function ban(row) {
  try {
    await ElMessageBox.confirm(
      `按文件封禁这个素材？文件立刻删除，用到它的 ${row.campaignCount} 个战役里它都会消失（缺图空白、缺音静默），资源库里指向它的 ${row.shareCount} 条分享一起下架，以后谁都不能再传同样的文件。`,
      '封禁素材（违规内容）',
      { type: 'error', confirmButtonText: '封禁', confirmButtonClass: 'el-button--danger' },
    )
  } catch {
    return
  }
  await api.banCampaignAsset(row.sha256)
  ElMessage.success('已封禁')
  drawer.value = false
  load()
}

async function unlist(row) {
  let reason
  try {
    ;({ value: reason } = await ElMessageBox.prompt(
      '从资源库下架：Maker 商店里不再看得到它，文件不删、用到它的战役照常。理由作者在「我的分享」里看得到（留空 = 运营下架）。',
      '下架',
      { inputPlaceholder: '运营下架', inputValidator: (v) => (v || '').length <= 500 || '最多 500 字', type: 'warning' },
    ))
  } catch {
    return
  }
  const res = await api.unlistCampaignAsset(row.sha256, (reason || '').trim())
  ElMessage.success(`已下架 ${res.unlisted} 条分享`)
  drawer.value = false
  load()
}

async function unban(row) {
  try {
    await ElMessageBox.confirm(
      '解封 = 允许再传这个文件。文件当初封禁时已经删了，不会自己回来：用到它的战役要作者重新发布一版才会补上。',
      '解封素材',
      { type: 'warning', confirmButtonText: '解封' },
    )
  } catch {
    return
  }
  await api.unbanCampaignAsset(row.sha256)
  ElMessage.success('已解封')
  drawer.value = false
  load()
}

// rows 缺省 = 勾选的那些；行里 / 详情里的单个「删除」也走这里
async function batch(action, rows) {
  const picked = rows || selected.value
  if (!picked.length) return
  const n = picked.length
  const campaigns = picked.reduce((sum, r) => sum + (r.campaignCount || 0), 0)
  let reason = ''
  try {
    if (action === 'unlist') {
      ;({ value: reason } = await ElMessageBox.prompt(
        `把选中的 ${n} 个文件从资源库下架：Maker 商店里不再看得到，文件不删、战役照常。理由作者看得到（留空 = 运营下架）。`,
        '批量下架',
        { inputPlaceholder: '运营下架', inputValidator: (v) => (v || '').length <= 500 || '最多 500 字', type: 'warning' },
      ))
    } else if (action === 'ban') {
      await ElMessageBox.confirm(
        `封禁选中的 ${n} 个文件？文件立刻删除，用到它们的战役（合计 ${campaigns} 个次）里都会缺图 / 缺声，资源库分享一起下架，以后谁都不能再传同样的文件。`,
        '批量封禁（违规内容）',
        { type: 'error', confirmButtonText: '封禁', confirmButtonClass: 'el-button--danger' },
      )
    } else {
      await ElMessageBox.confirm(
        `删除选中的 ${n} 个文件？文件与记录一起删，资源库里指向它们的分享一起删掉；用到它们的战役（合计 ${campaigns} 个次）里会缺图 / 缺声，作者重新发布时会补传。不拦再传（要拦用封禁）。`,
        '批量删除',
        { type: 'error', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger' },
      )
    }
  } catch {
    return
  }
  acting.value = true
  try {
    const res = await api.batchCampaignAssets(picked.map((r) => r.sha256), action, (reason || '').trim())
    const verb = { unlist: '下架', ban: '封禁', delete: '删除' }[action]
    ElMessage.success(action === 'unlist' ? `已下架 ${res.changed} 条分享` : `已${verb} ${res.changed} 个文件`)
    drawer.value = false
    load()
  } finally {
    acting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
      <template #title>
        这里是所有战役用到的全部文件（作者发布战役时包里引用的图 / 声 / 视频都会传上来存一份），给你按文件封禁违规内容用。
        Maker 资源商店里只有作者勾选分享、且审核通过的那部分——要看商店里有什么，状态选「资源库已上架」，或去「资源库审核」页。
      </template>
    </el-alert>
    <div class="page-toolbar">
      <el-select v-model="query.kind" style="width: 110px" @change="search">
        <el-option label="全部类型" value="" />
        <el-option label="图片" value="image" />
        <el-option label="声音" value="audio" />
        <el-option label="视频" value="video" />
      </el-select>
      <el-select v-model="query.status" style="width: 170px" @change="search">
        <el-option label="全部（含封禁）" value="" />
        <el-option label="正常" value="active" />
        <el-option label="已封禁" value="banned" />
        <el-option label="资源库已上架（商店可见）" value="listed" />
        <el-option label="资源库待审" value="sharePending" />
        <el-option label="分享过资源库（含待审 / 被拒）" value="shared" />
      </el-select>
      <el-input
        v-model="query.q"
        placeholder="哈希前缀 / 战役标题 / 分享名"
        clearable
        style="width: 240px"
        @keyup.enter="search"
        @clear="search"
      />
      <el-button type="primary" @click="search">查询</el-button>
      <div class="spacer" />
      <span style="color: #909399">共 {{ total }} 个文件</span>
    </div>

    <div class="batch-bar">
      <span>已选 {{ selected.length }} 个</span>
      <el-button type="warning" size="small" :disabled="!selected.length" :loading="acting" @click="batch('unlist')">批量下架</el-button>
      <el-button type="danger" size="small" plain :disabled="!selected.length" :loading="acting" @click="batch('ban')">批量封禁</el-button>
      <el-button type="danger" size="small" :disabled="!selected.length" :loading="acting" @click="batch('delete')">批量删除</el-button>
    </div>

    <el-table
      :data="rows"
      v-loading="loading"
      border
      row-key="sha256"
      style="cursor: pointer"
      @sort-change="onSort"
      @row-click="open"
      @selection-change="(v) => (selected = v)"
    >
      <el-table-column type="selection" width="44" />
      <el-table-column label="预览" width="150">
        <template #default="{ row }">
          <div v-if="row.isBanned" class="preview-ph"><span style="color: #f56c6c">已封禁</span></div>
          <template v-else-if="kindOf(row) === 'image'">
            <el-image
              v-if="!thumbError[row.sha256]"
              :src="row.url"
              fit="contain"
              lazy
              style="width: 64px; height: 64px; background: #f0f2f5; border-radius: 4px"
              :preview-src-list="[row.url]"
              hide-on-click-modal
              preview-teleported
              @click.stop
              @error="thumbError[row.sha256] = true"
            />
            <div v-else class="preview-ph"><el-icon><Picture /></el-icon><span>文件已删</span></div>
          </template>
          <template v-else-if="kindOf(row) === 'video'">
            <video v-if="mediaOn[row.sha256]" :src="row.url" controls autoplay style="width: 130px" @click.stop />
            <el-button v-else link type="primary" @click.stop="mediaOn[row.sha256] = true">
              <el-icon style="margin-right: 4px"><VideoPlay /></el-icon>播放
            </el-button>
          </template>
          <template v-else>
            <audio v-if="mediaOn[row.sha256]" :src="row.url" controls autoplay style="width: 130px" @click.stop />
            <el-button v-else link type="primary" @click.stop="mediaOn[row.sha256] = true">
              <el-icon style="margin-right: 4px"><Headset /></el-icon>试听
            </el-button>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="文件" min-width="200">
        <template #default="{ row }">
          <div v-if="row.shareName"><strong>{{ row.shareName }}</strong></div>
          <code style="font-size: 12px; color: #909399" :title="row.sha256">{{ row.sha256.slice(0, 16) }}…{{ row.ext }}</code>
        </template>
      </el-table-column>
      <el-table-column prop="size" label="大小" width="100" sortable="custom">
        <template #default="{ row }">{{ fmtBytes(row.size) }}</template>
      </el-table-column>
      <el-table-column prop="campaigns" label="用到它的战役数" width="140" sortable="custom">
        <template #default="{ row }">{{ row.campaignCount }}</template>
      </el-table-column>
      <el-table-column label="资源库" width="130">
        <template #default="{ row }">
          <template v-if="row.shareCount">
            <el-tag v-if="row.approvedShareCount" type="success" size="small">已上架</el-tag>
            <el-tag v-else-if="row.pendingShareCount" type="warning" size="small">待审</el-tag>
            <el-tag v-else type="info" size="small">被拒</el-tag>
            <span v-if="row.shareCount > 1" style="margin-left: 4px; color: #909399; font-size: 12px">{{ row.shareCount }} 条分享</span>
          </template>
          <span v-else style="color: #c0c4cc">未分享</span>
        </template>
      </el-table-column>
      <el-table-column prop="firstOwnerName" label="首传者" width="120" />
      <el-table-column prop="createdAt" label="上传时间" width="160" sortable="custom">
        <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button v-if="!row.isBanned && row.approvedShareCount" link type="warning" @click.stop="unlist(row)">下架</el-button>
          <el-button v-if="row.isBanned" link type="warning" @click.stop="unban(row)">解封</el-button>
          <el-button v-else link type="danger" @click.stop="ban(row)">封禁</el-button>
          <el-button v-if="!row.isBanned" link type="danger" @click.stop="batch('delete', [row])">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="batch-bar">
      <span>已选 {{ selected.length }} 个</span>
      <el-button type="warning" size="small" :disabled="!selected.length" :loading="acting" @click="batch('unlist')">批量下架</el-button>
      <el-button type="danger" size="small" plain :disabled="!selected.length" :loading="acting" @click="batch('ban')">批量封禁</el-button>
      <el-button type="danger" size="small" :disabled="!selected.length" :loading="acting" @click="batch('delete')">批量删除</el-button>
    </div>

    <div class="pager">
      <el-pagination
        layout="prev, pager, next"
        :total="total"
        :page-size="PAGE_SIZE"
        :current-page="query.page"
        @current-change="(p) => { query.page = p; load() }"
      />
    </div>

    <el-drawer v-model="drawer" size="50%" title="素材详情">
      <div v-loading="detailLoading">
        <template v-if="detail && detailRow">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="哈希" :span="2"><code style="word-break: break-all">{{ detail.sha256 }}</code></el-descriptions-item>
            <el-descriptions-item label="大小">{{ fmtBytes(detailRow.size) }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag v-if="detailRow.isBanned" type="danger" size="small">已封禁</el-tag>
              <el-tag v-else type="success" size="small">正常</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="首传者">{{ detailRow.firstOwnerName || '—' }}</el-descriptions-item>
            <el-descriptions-item label="上传时间">{{ fmtDate(detailRow.createdAt) }}</el-descriptions-item>
          </el-descriptions>

          <div style="margin: 12px 0">
            <el-button v-if="!detailRow.isBanned && detailRow.approvedShareCount" type="warning" @click="unlist(detailRow)">
              从资源库下架
            </el-button>
            <el-button v-if="detailRow.isBanned" type="warning" @click="unban(detailRow)">解封</el-button>
            <el-button v-else type="danger" @click="ban(detailRow)">封禁素材</el-button>
            <el-button v-if="!detailRow.isBanned" type="danger" plain @click="batch('delete', [detailRow])">删除素材</el-button>
          </div>

          <h4>用到它的战役（{{ detail.campaigns.length }} 个版本）</h4>
          <el-table :data="detail.campaigns" size="small" border empty-text="没有战役用到它">
            <el-table-column label="战役" min-width="160">
              <template #default="{ row }">
                {{ row.title }}
                <el-tag v-if="row.campaignBanned" type="danger" size="small" style="margin-left: 4px">战役已封禁</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="版本" width="90">
              <template #default="{ row }">第 {{ row.gameVersion }} 版</template>
            </el-table-column>
            <el-table-column label="这一版" width="130">
              <template #default="{ row }">
                {{ revisionStatus[row.status] || row.status }}
                <el-tag v-if="row.isLive" type="success" size="small" style="margin-left: 4px">对外</el-tag>
                <el-tag v-else-if="row.isPending" type="warning" size="small" style="margin-left: 4px">待审</el-tag>
              </template>
            </el-table-column>
          </el-table>

          <h4>资源库分享（{{ detail.shares.length }}）</h4>
          <el-table :data="detail.shares" size="small" border empty-text="没人分享过">
            <el-table-column prop="name" label="名字" min-width="140" />
            <el-table-column prop="ownerName" label="分享者" width="110" />
            <el-table-column label="状态" width="150">
              <template #default="{ row }">
                <el-tag :type="shareType[row.status]" size="small">{{ shareStatus[row.status] || row.status }}</el-tag>
                <div v-if="row.rejectReason" style="color: #909399; font-size: 12px">{{ row.rejectReason }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="downloadCount" label="下载" width="70" />
          </el-table>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  color: #606266;
  font-size: 13px;
}
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
