<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { fmtBytes, fmtDate } from '../utils/format'
import { PAGE_SIZE } from '../config'

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const quotaDefaults = ref({ campaignQuota: 0, resourceQuota: 0, blobTotalBytes: 0 })
const query = reactive({ q: '', sort: 'createdAt', order: 'desc', page: 1 })

async function load() {
  loading.value = true
  try {
    const res = await api.users({ ...query })
    rows.value = res.items
    total.value = res.total
    if (res.defaults) quotaDefaults.value = res.defaults
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
      banning
        ? `封禁「${row.displayName}」？将无法登录、无法下载，其上传的所有战役/资源也不可被他人下载。已登录会话会被踢下线。`
        : `解封「${row.displayName}」？`,
      banning ? '封禁用户' : '解封用户',
      { type: banning ? 'warning' : 'info' },
    )
  } catch {
    return
  }
  banning ? await api.banUser(row.playerId) : await api.unbanUser(row.playerId)
  row.isBanned = banning
  ElMessage.success(banning ? '已封禁' : '已解封')
}

const MB = 1024 * 1024

async function editBlobQuota(row) {
  try {
    const { value } = await ElMessageBox.prompt(
      '设置该用户图床总量上限（MB，0 = 用全局默认）',
      `修改「${row.displayName}」图床上限`,
      {
        inputValue: String(Math.round((row.blobQuotaBytes || 0) / MB)),
        inputPattern: /^\d+$/,
        inputErrorMessage: '请输入非负整数（MB）',
      },
    )
    const res = await api.setBlobQuota(row.playerId, Number(value) * MB)
    row.blobQuotaBytes = res.blobQuotaBytes
    ElMessage.success('已更新图床上限')
  } catch {
    /* 取消 */
  }
}

async function editCampaignQuota(row) {
  try {
    const { value } = await ElMessageBox.prompt(
      '设置该用户战役数上限（0 = 用统一默认）',
      `修改「${row.displayName}」战役上限`,
      {
        inputValue: String(row.campaignQuota || 0),
        inputPattern: /^\d+$/,
        inputErrorMessage: '请输入非负整数',
      },
    )
    const res = await api.setCampaignQuota(row.playerId, Number(value))
    row.campaignQuota = res.campaignQuota
    ElMessage.success('已更新战役上限')
  } catch {
    /* 取消 */
  }
}

async function editResourceQuota(row) {
  try {
    const { value } = await ElMessageBox.prompt(
      '设置该用户资源数上限（0 = 用统一默认）',
      `修改「${row.displayName}」资源上限`,
      {
        inputValue: String(row.resourceQuota || 0),
        inputPattern: /^\d+$/,
        inputErrorMessage: '请输入非负整数',
      },
    )
    const res = await api.setResourceQuota(row.playerId, Number(value))
    row.resourceQuota = res.resourceQuota
    ElMessage.success('已更新资源上限')
  } catch {
    /* 取消 */
  }
}
async function toggleReviewer(row) {
  const granting = !row.isReviewer
  try {
    await ElMessageBox.confirm(
      granting
        ? `把「${row.displayName}」设为官方试玩账号？该账号将能在 maker 商城搜到未过审战役、下载试玩，并审批上架。`
        : `收回「${row.displayName}」的官方试玩账号权限？`,
      granting ? '授予官方试玩账号' : '收回官方试玩账号',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await api.setReviewer(row.playerId, granting)
  row.isReviewer = granting
  ElMessage.success(granting ? '已授予' : '已收回')
}

async function toggleFeaturedMaker(row) {
  const granting = !row.isFeaturedMaker
  try {
    await ElMessageBox.confirm(
      granting
        ? `把「${row.displayName}」标为精品制作人？maker 会在他的主页与全部作品行上画这个牌子，不影响任何权限。`
        : `摘掉「${row.displayName}」的精品制作人牌子？`,
      granting ? '标为精品制作人' : '取消精品制作人',
      { type: 'info' },
    )
  } catch {
    return
  }
  await api.setFeaturedMaker(row.playerId, granting)
  row.isFeaturedMaker = granting
  ElMessage.success(granting ? '已标记' : '已取消')
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-toolbar">
      <el-input
        v-model="query.q"
        placeholder="按昵称 / 邮箱搜索"
        clearable
        style="width: 260px"
        @keyup.enter="search"
        @clear="search"
      />
      <el-button type="primary" @click="search">搜索</el-button>
      <div class="spacer" />
      <span style="color: #909399">共 {{ total }} 人</span>
    </div>

    <el-table :data="rows" v-loading="loading" @sort-change="onSort" border>
      <el-table-column prop="displayName" label="昵称" min-width="120">
        <template #default="{ row }">
          {{ row.displayName }}
          <el-tag v-if="row.isBanned" type="danger" size="small">已封禁</el-tag>
          <el-tag v-if="row.isReviewer" type="warning" size="small">官方试玩</el-tag>
          <el-tag v-if="row.isFeaturedMaker" type="success" size="small">精品制作人</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column prop="campaignCount" label="战役 占用/上限" width="130" sortable="custom">
        <template #default="{ row }">
          {{ row.campaignCount }} /
          <template v-if="row.campaignQuota > 0">{{ row.campaignQuota }}</template>
          <span v-else style="color: #909399">{{ quotaDefaults.campaignQuota }}(默认)</span>
        </template>
      </el-table-column>
      <el-table-column prop="resourceCount" label="资源 占用/上限" width="130" sortable="custom">
        <template #default="{ row }">
          {{ row.resourceCount }} /
          <template v-if="row.resourceQuota > 0">{{ row.resourceQuota }}</template>
          <span v-else style="color: #909399">{{ quotaDefaults.resourceQuota }}(默认)</span>
        </template>
      </el-table-column>
      <el-table-column prop="blobStorageBytes" label="图床 占用/上限" width="180" sortable="custom">
        <template #default="{ row }">
          {{ fmtBytes(row.blobStorageBytes) }} /
          <template v-if="row.blobQuotaBytes > 0">{{ fmtBytes(row.blobQuotaBytes) }}</template>
          <span v-else style="color: #909399">{{ fmtBytes(quotaDefaults.blobTotalBytes) }}(默认)</span>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="注册时间" width="150" sortable="custom">
        <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="500" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="editCampaignQuota(row)">改战役上限</el-button>
          <el-button link type="primary" @click="editResourceQuota(row)">改资源上限</el-button>
          <el-button link type="primary" @click="editBlobQuota(row)">改图床上限</el-button>
          <el-button link type="warning" @click="toggleReviewer(row)">
            {{ row.isReviewer ? '取消试玩号' : '设为试玩号' }}
          </el-button>
          <el-button link type="success" @click="toggleFeaturedMaker(row)">
            {{ row.isFeaturedMaker ? '取消精品制作人' : '设为精品制作人' }}
          </el-button>
          <el-button link :type="row.isBanned ? 'success' : 'danger'" @click="toggleBan(row)">
            {{ row.isBanned ? '解封' : '封禁' }}
          </el-button>
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
  </div>
</template>
