<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { fmtBytes, fmtDate } from '../utils/format'
import { PAGE_SIZE } from '../config'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({
  owner: route.query.owner || '',
  q: '',
  status: 'live', // 默认不列已删的（只剩墓碑）
  sort: 'createdAt',
  order: 'desc',
  page: 1,
})

async function load() {
  loading.value = true
  try {
    const res = await api.campaigns({ ...query })
    rows.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}
function search() {
  query.page = 1
  load()
}
function onSort({ prop, order }) {
  if (!order) return
  query.sort = prop
  query.order = order === 'ascending' ? 'asc' : 'desc'
  load()
}

async function toggleBan(row) {
  const banning = !row.isBanned
  try {
    await ElMessageBox.confirm(
      banning ? `封禁下载「${row.title}」？所有人（含已购买者）将无法下载。可随时解封。` : `解封「${row.title}」？`,
      banning ? '封禁战役' : '解封战役',
      { type: 'warning' },
    )
  } catch {
    return
  }
  banning ? await api.banCampaign(row.id) : await api.unbanCampaign(row.id)
  row.isBanned = banning
  ElMessage.success(banning ? '已封禁下载' : '已解封')
}

async function hardDelete(row) {
  try {
    await ElMessageBox.confirm(
      row.workshopItemId
        ? `硬删除「${row.title}」？本服只有这条索引行，删掉后该条目的房间/收藏一并没了；Steam 上的条目本身不受影响（要拦内容请去「创意工坊」页把条目 id 加进名单）。不可恢复。`
        : `硬删除「${row.title}」？将删除战役包（${fmtBytes(row.sizeBytes)}）、全部房间（含进行中的）与收藏，并回收没人再用的素材，不可恢复。战役编号仍归原作者，别人不能拿它重新上传。`,
      '硬删除（不可逆）',
      { type: 'error', confirmButtonText: '确认删除', confirmButtonClass: 'el-button--danger' },
    )
  } catch {
    return
  }
  await api.deleteCampaign(row.id)
  ElMessage.success('已删除')
  load()
}

async function toggleFeatured(row) {
  const on = !row.isFeatured
  await api.setCampaignFeatured(row.id, on)
  row.isFeatured = on
  ElMessage.success(on ? '已设为精品' : '已取消精品')
}

async function togglePinned(row) {
  const on = !row.isPinned
  await api.setCampaignPinned(row.id, on)
  row.isPinned = on
  ElMessage.success(on ? '已置顶' : '已取消置顶')
}

// 网页版：过审的战役都能在官网「在线游戏」里玩，这里定要不要先登录
async function setWebLogin(row, on) {
  await api.setCampaignWebLoginRequired(row.id, on)
  row.webLoginRequired = on
  ElMessage.success(on ? '网页版改为要先登录' : '网页版不用登录')
}
onMounted(load)
</script>

<template>
  <div>
    <div class="page-toolbar">
      <el-input v-model="query.owner" placeholder="上传者 playerId" clearable style="width: 180px" @keyup.enter="search" @clear="search" />
      <el-input v-model="query.q" placeholder="战役名" clearable style="width: 200px" @keyup.enter="search" @clear="search" />
      <el-select v-model="query.status" style="width: 130px" @change="search">
        <el-option label="全部（不含已删）" value="live" />
        <el-option label="全部（含已删）" value="all" />
        <el-option label="正常" value="active" />
        <el-option label="已删（墓碑）" value="deleted" />
        <el-option label="已封禁" value="banned" />
      </el-select>
      <el-button type="primary" @click="search">搜索</el-button>
      <div class="spacer" />
      <span style="color: #909399">共 {{ total }} 条</span>
    </div>

    <el-table :data="rows" v-loading="loading" @sort-change="onSort" border>
      <el-table-column prop="title" label="标题" min-width="160">
        <template #default="{ row }">
          {{ row.title }}
          <el-tag v-if="row.isPinned" type="danger" size="small" effect="dark">置顶</el-tag>
          <el-tag v-if="row.isFeatured" type="success" size="small" effect="dark">精品</el-tag>
          <el-tag v-if="row.isBanned" type="danger" size="small">封禁</el-tag>
          <el-tag v-if="row.isDeleted" type="info" size="small">已删</el-tag>
          <el-tag v-if="row.approvalStatus === 'pending'" type="warning" size="small">待审核</el-tag>
          <el-tag
            v-else-if="row.approvalStatus === 'rejected'"
            type="danger"
            size="small"
            :title="row.rejectReason"
          >
            驳回·不曝光
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="来源" width="150">
        <template #default="{ row }">
          <a
            v-if="row.workshopItemId"
            :href="`https://steamcommunity.com/sharedfiles/filedetails/?id=${row.workshopItemId}`"
            target="_blank"
            rel="noopener"
          >
            工坊 #{{ row.workshopItemId }}
          </a>
          <span v-else style="color: #909399">官方托管</span>
        </template>
      </el-table-column>
      <el-table-column label="版本" width="90">
        <template #default="{ row }">{{ row.gameVersion > 0 ? `第 ${row.gameVersion} 版` : '—' }}</template>
      </el-table-column>
      <el-table-column prop="ownerName" label="上传者" width="120" />
      <el-table-column prop="era" label="年代" width="90" />
      <el-table-column prop="downloadCount" label="下载" width="90" sortable="custom" />
      <el-table-column label="网页版要登录" width="110">
        <template #default="{ row }">
          <el-switch :model-value="row.webLoginRequired" @change="(v) => setWebLogin(row, v)" />
          <div style="color: #909399; font-size: 12px">打开 {{ row.webPlayCount || 0 }} 次</div>
        </template>
      </el-table-column>
      <el-table-column prop="sizeBytes" label="包大小" width="110">
        <template #default="{ row }">{{ row.workshopItemId ? '—' : fmtBytes(row.sizeBytes) }}</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="上传时间" width="150" sortable="custom">
        <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="340" fixed="right">
        <template #default="{ row }">
          <!-- 放行 / 驳回在「战役审核」页，这里直接跳过去打开这一版 -->
          <el-button
            v-if="row.approvalStatus === 'pending'"
            link
            type="primary"
            @click="router.push({ name: 'review', query: { campaign: row.id } })"
          >
            去审核
          </el-button>
          <el-button link type="danger" @click="togglePinned(row)">
            {{ row.isPinned ? '取消置顶' : '置顶' }}
          </el-button>
          <el-button link type="success" @click="toggleFeatured(row)">
            {{ row.isFeatured ? '取消精品' : '精品' }}
          </el-button>
          <el-button link :type="row.isBanned ? 'success' : 'warning'" @click="toggleBan(row)">
            {{ row.isBanned ? '解封' : '封禁' }}
          </el-button>
          <!-- 已删的只剩一块墓碑：内容早清掉了，留着这一行是为了战役编号永远归原作者、别人不能拿它冒名上传，再删也无事可做 -->
          <el-button v-if="!row.isDeleted" link type="danger" @click="hardDelete(row)">硬删</el-button>
          <el-tooltip v-else content="内容已清掉，只留这一行保住战役编号（别人不能拿同一编号上传）；作者本人再传会原地复活" placement="top">
            <span class="tomb-note">已删（留墓碑）</span>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination layout="prev, pager, next" :total="total" :page-size="PAGE_SIZE" :current-page="query.page" @current-change="(p) => { query.page = p; load() }" />
    </div>
  </div>
</template>

<style scoped>
.tomb-note { color: var(--el-text-color-secondary); font-size: 12px; cursor: help; }
</style>
