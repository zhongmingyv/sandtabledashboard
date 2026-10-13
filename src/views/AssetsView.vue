<script setup>
// 素材管理：作者发布战役时传上来的素材（R2 上按内容哈希一份，同一张图被多个战役用到只存一份）。
// 看每个文件被哪些战役用到、有没有分享到资源库；按文件封禁 = 文件当场删，所有用到它的战役里它一起消失、资源库里指向它的分享一起下架。
// 解封 = 撤掉墓碑：文件已经删了不会回来，作者重新发布时补传。取代老图床管理页（老图床早已不收新图）。
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

async function open(row) {
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

onMounted(load)
</script>

<template>
  <div>
    <div class="page-toolbar">
      <el-select v-model="query.kind" style="width: 110px" @change="search">
        <el-option label="全部类型" value="" />
        <el-option label="图片" value="image" />
        <el-option label="声音" value="audio" />
        <el-option label="视频" value="video" />
      </el-select>
      <el-select v-model="query.status" style="width: 130px" @change="search">
        <el-option label="全部（含封禁）" value="" />
        <el-option label="正常" value="active" />
        <el-option label="已封禁" value="banned" />
        <el-option label="分享到资源库的" value="shared" />
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

    <el-table :data="rows" v-loading="loading" border @sort-change="onSort" @row-click="open" style="cursor: pointer">
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
      <el-table-column prop="campaigns" label="用到它的战役" width="130" sortable="custom">
        <template #default="{ row }">{{ row.campaignCount }}</template>
      </el-table-column>
      <el-table-column label="资源库" width="130">
        <template #default="{ row }">
          <template v-if="row.shareCount">
            {{ row.shareCount }} 条<span v-if="row.approvedShareCount">（{{ row.approvedShareCount }} 条上架）</span>
          </template>
          <span v-else style="color: #c0c4cc">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="firstOwnerName" label="首传者" width="120" />
      <el-table-column prop="createdAt" label="上传时间" width="160" sortable="custom">
        <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.isBanned" link type="warning" @click.stop="unban(row)">解封</el-button>
          <el-button v-else link type="danger" @click.stop="ban(row)">封禁</el-button>
        </template>
      </el-table-column>
    </el-table>

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
            <el-button v-if="detailRow.isBanned" type="warning" @click="unban(detailRow)">解封</el-button>
            <el-button v-else type="danger" @click="ban(detailRow)">封禁素材</el-button>
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
