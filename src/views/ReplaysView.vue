<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { fmtBytes, fmtDate } from '../utils/format'
import { PAGE_SIZE } from '../config'

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const selection = ref([])
const purgeOps = ref(false)
const query = reactive({ campaignId: '', sort: 'createdAt', order: 'desc', page: 1 })

async function load() {
  loading.value = true
  try {
    const res = await api.replays({ ...query })
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

async function delOne(row) {
  try {
    await ElMessageBox.confirm(
      `删除复盘「${row.title}」？${purgeOps.value ? '并回收该对局操作流（若无其它复盘引用），可省 ' + fmtBytes(row.matchOpBytes) : '仅删书签，不省磁盘'}。`,
      '删除复盘',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await api.deleteReplay(row.replayId, purgeOps.value)
  ElMessage.success('已删除')
  load()
}

async function delBatch() {
  if (!selection.value.length) {
    ElMessage.warning('请先勾选复盘')
    return
  }
  try {
    await ElMessageBox.confirm(
      `批量删除 ${selection.value.length} 条复盘？${purgeOps.value ? '并回收无引用的操作流。' : ''}`,
      '批量删除',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await api.batchDeleteReplays({ replayIds: selection.value.map((r) => r.replayId), purgeOps: purgeOps.value })
  ElMessage.success('已批量删除')
  load()
}

async function delByCondition() {
  try {
    const { value } = await ElMessageBox.prompt(
      '删除该条件下、此时间点之前的全部复盘（ISO 时间，如 2026-06-01）。当前战役过滤：' + (query.campaignId || '（全部）'),
      '按条件批量删除',
      { inputPlaceholder: 'YYYY-MM-DD' },
    )
    const res = await api.batchDeleteReplays({
      campaignId: query.campaignId || undefined,
      before: new Date(value).toISOString(),
      purgeOps: purgeOps.value,
    })
    ElMessage.success(`已删除 ${res.removed} 条`)
    load()
  } catch {
    /* 取消 */
  }
}
onMounted(load)
</script>

<template>
  <div>
    <div class="page-toolbar">
      <el-input v-model="query.campaignId" placeholder="按战役 id 过滤" clearable style="width: 200px" @keyup.enter="search" @clear="search" />
      <el-button type="primary" @click="search">搜索</el-button>
      <el-checkbox v-model="purgeOps" style="margin-left: 8px">连带回收操作流（省空间）</el-checkbox>
      <div class="spacer" />
      <el-button type="danger" plain @click="delBatch">删除选中</el-button>
      <el-button type="danger" @click="delByCondition">按条件批删</el-button>
    </div>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 12px"
      title="删复盘行本身几乎不省磁盘——真正占地的是对局操作流。勾选「连带回收操作流」才会在无其它复盘引用时清理底层 ops。"
    />

    <el-table :data="rows" v-loading="loading" @sort-change="onSort" @selection-change="(s) => (selection = s)" border>
      <el-table-column type="selection" width="45" />
      <el-table-column prop="title" label="复盘" min-width="120" />
      <el-table-column prop="campaignTitle" label="所属战役" min-width="150" />
      <el-table-column prop="matchId" label="对局" width="110" />
      <el-table-column prop="opCount" label="op 数" width="100" />
      <el-table-column prop="matchOpBytes" label="操作流大小" width="120">
        <template #default="{ row }">{{ fmtBytes(row.matchOpBytes) }}</template>
      </el-table-column>
      <el-table-column prop="sharedByReplayCount" label="共享复盘数" width="110" />
      <el-table-column prop="createdAt" label="创建时间" width="150" sortable="custom">
        <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="danger" @click="delOne(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination layout="prev, pager, next" :total="total" :page-size="PAGE_SIZE" :current-page="query.page" @current-change="(p) => { query.page = p; load() }" />
    </div>
  </div>
</template>
