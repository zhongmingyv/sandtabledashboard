<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { fmtDate } from '../utils/format'
import { PAGE_SIZE } from '../config'

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({ state: 'all', q: '', page: 1 })

const stateLabel = { Waiting: '等人', Playing: '对战中' }

async function load(quiet = false) {
  if (!quiet) loading.value = true
  try {
    const res = await api.matches({ ...query })
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

// 同用户版窗口那张表：定时刷新，谁上线、谁走了、最后一步都跟着变
let timer
onMounted(() => {
  load()
  timer = setInterval(() => load(true), 10000)
})
onUnmounted(() => clearInterval(timer))

function seatsOf(row) {
  return row.seats.filter((s) => !s.hasLeft)
}
function isOnline(row, seat) {
  return row.onlinePlayerIds.includes(seat.playerId)
}

async function release(row) {
  try {
    await ElMessageBox.confirm(
      `解散「${row.campaignTitle}」这一桌？在座的人会立刻收到「对局已结束」，之后谁都不能再下，这一局不能再接着打。棋局记录留在服务器上，玩家仍能进桌看终盘。`,
      '解散房间',
      { type: 'warning', confirmButtonText: '解散', confirmButtonClass: 'el-button--danger' },
    )
  } catch {
    return
  }
  const res = await api.releaseMatch(row.matchId)
  ElMessage.success(res.released ? '已解散' : '这一桌已经结束了')
  load()
}
</script>

<template>
  <div>
    <div class="page-toolbar">
      <el-select v-model="query.state" style="width: 130px" @change="search">
        <el-option label="全部" value="all" />
        <el-option label="等人" value="Waiting" />
        <el-option label="对战中" value="Playing" />
      </el-select>
      <el-input v-model="query.q" placeholder="战役名" clearable style="width: 200px" @keyup.enter="search" @clear="search" />
      <el-button type="primary" @click="search">搜索</el-button>
      <div class="spacer" />
      <span style="color: #909399">共 {{ total }} 间 · 每 10 秒刷新</span>
    </div>

    <el-table :data="rows" v-loading="loading" border row-key="matchId">
      <el-table-column label="战役" min-width="160">
        <template #default="{ row }">
          {{ row.campaignTitle }}
          <el-tag v-if="row.workshopItemId" size="small" type="info">工坊</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.state === 'Playing' ? 'success' : 'warning'">
            {{ stateLabel[row.state] || row.state }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="在座（● 在线）" min-width="220">
        <template #default="{ row }">
          <span v-for="s in seatsOf(row)" :key="s.seatIndex" style="margin-right: 12px; white-space: nowrap">
            <span :style="{ color: isOnline(row, s) ? '#67c23a' : '#c0c4cc' }">●</span>
            {{ s.playerName }}<span style="color: #909399">·{{ s.factionName }}</span>
            <el-tag v-if="s.seatIndex === row.hostSeatIndex" size="small" effect="plain">房主</el-tag>
          </span>
          <span v-if="seatsOf(row).length === 0" style="color: #909399">没人</span>
        </template>
      </el-table-column>
      <el-table-column label="空位 / AI" width="130">
        <template #default="{ row }">
          <div v-if="row.vacantFactions.length">空 {{ row.vacantFactions.length }}</div>
          <div v-if="row.aiFactions.length">AI {{ row.aiFactions.length }}</div>
          <span v-if="!row.vacantFactions.length && !row.aiFactions.length" style="color: #909399">—</span>
        </template>
      </el-table-column>
      <el-table-column label="开桌" width="150">
        <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="最后一步" width="150">
        <template #default="{ row }">{{ fmtDate(row.lastOpAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="danger" @click="release(row)">解散</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination layout="prev, pager, next" :total="total" :page-size="PAGE_SIZE" :current-page="query.page" @current-change="(p) => { query.page = p; load() }" />
    </div>
  </div>
</template>
