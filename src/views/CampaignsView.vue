<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { fmtBytes, fmtDate } from '../utils/format'
import { PAGE_SIZE } from '../config'

const route = useRoute()
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({
  owner: route.query.owner || '',
  q: '',
  status: 'all',
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
      `硬删除「${row.title}」？将物理删除 zip（${fmtBytes(row.sizeBytes)}）并触发 blob 回收，不可恢复。`,
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
onMounted(load)
</script>

<template>
  <div>
    <div class="page-toolbar">
      <el-input v-model="query.owner" placeholder="上传者 playerId" clearable style="width: 180px" @keyup.enter="search" @clear="search" />
      <el-input v-model="query.q" placeholder="战役名" clearable style="width: 200px" @keyup.enter="search" @clear="search" />
      <el-select v-model="query.status" style="width: 130px" @change="search">
        <el-option label="全部" value="all" />
        <el-option label="正常" value="active" />
        <el-option label="作者已删" value="deleted" />
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
          <el-tag v-if="row.isBanned" type="danger" size="small">封禁</el-tag>
          <el-tag v-if="row.isDeleted" type="info" size="small">作者删</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="ownerName" label="上传者" width="120" />
      <el-table-column prop="era" label="年代" width="90" />
      <el-table-column prop="price" label="定价" width="90" sortable="custom" />
      <el-table-column prop="downloadCount" label="下载" width="90" sortable="custom" />
      <el-table-column prop="replayCount" label="复盘" width="80" />
      <el-table-column prop="sizeBytes" label="包大小" width="110">
        <template #default="{ row }">{{ fmtBytes(row.sizeBytes) }}</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="上传时间" width="150" sortable="custom">
        <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link :type="row.isBanned ? 'success' : 'warning'" @click="toggleBan(row)">
            {{ row.isBanned ? '解封' : '封禁' }}
          </el-button>
          <el-button link type="danger" @click="hardDelete(row)">硬删</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination layout="prev, pager, next" :total="total" :page-size="PAGE_SIZE" :current-page="query.page" @current-change="(p) => { query.page = p; load() }" />
    </div>
  </div>
</template>
