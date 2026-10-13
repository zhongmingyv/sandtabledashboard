<script setup>
// Bot 擂台：擂主给每个阵营定谁来下（擂主守 / 交给 bot / 留给挑战者），挑战者包下所有留给他的阵营。
// 本期只记胜负平、没有排行榜。这里看所有擂台（含擂主被封的），下架不合适的 = 撤擂：擂台与战绩删掉，正在打的挑战一起结束。
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { fmtDate } from '../utils/format'
import { PAGE_SIZE } from '../config'

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const query = reactive({ q: '', page: 1 })

const roleText = { owner: '擂主守', bot: '交给 Bot', open: '留给挑战者' }
const roleType = { owner: 'danger', bot: 'warning', open: 'success' }

async function load() {
  loading.value = true
  try {
    const res = await api.arenas({ ...query })
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

// 阵营 id → 名字（战役的阵营清单原样透传过来）
function factionName(row, id) {
  try {
    const f = JSON.parse(row.campaignFactionsJson || '[]').find((x) => x.factionId === id)
    return f?.name || id
  } catch {
    return id
  }
}

function botText(bot) {
  if (!bot) return ''
  if (bot.default) return '默认 Bot'
  if (bot.packaged) return `包内 ${String(bot.id).replace(/^pkg:/, '')}`
  return `${bot.name || bot.id}（${bot.ownerName || ''}）`
}

function roleList(row) {
  return Object.entries(row.roles || {}).map(([id, r]) => ({ id, name: factionName(row, id), role: r.role, bot: botText(r.bot) }))
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `下架「${row.ownerName}」在《${row.campaignTitle}》${row.levelName || row.levelId || ''} 摆的擂台？擂台与战绩一起删掉${row.running ? `，正在打的 ${row.running} 局挑战直接结束（不计结果）` : ''}。`,
      '下架擂台',
      { type: 'warning', confirmButtonText: '下架' },
    )
  } catch {
    return
  }
  await api.deleteArena(row.id)
  ElMessage.success('已下架')
  load()
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-toolbar">
      <el-input v-model="query.q" placeholder="战役标题 / 擂主名" clearable style="width: 220px" @keyup.enter="search" @clear="search" />
      <el-button type="primary" @click="search">查询</el-button>
      <div class="spacer" />
      <span style="color: #909399">共 {{ total }} 个擂台</span>
    </div>

    <el-table :data="rows" v-loading="loading" border>
      <el-table-column label="战役 / 关卡" min-width="170">
        <template #default="{ row }">
          <strong>{{ row.campaignTitle }}</strong>
          <div style="color: #909399; font-size: 12px">{{ row.levelName || row.levelId || '（不分关）' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="擂主" width="140">
        <template #default="{ row }">
          {{ row.ownerName }}
          <el-tag v-if="row.ownerBanned" type="danger" size="small" style="margin-left: 4px">已封</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="阵营安排" min-width="300">
        <template #default="{ row }">
          <div v-for="r in roleList(row)" :key="r.id" style="line-height: 22px">
            <el-tag :type="roleType[r.role]" size="small">{{ roleText[r.role] || r.role }}</el-tag>
            {{ r.name }}
            <span v-if="r.bot" style="color: #909399; font-size: 12px">· {{ r.bot }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="擂主 胜 / 负 / 平" width="140">
        <template #default="{ row }">{{ row.wins }} / {{ row.losses }} / {{ row.draws }}</template>
      </el-table-column>
      <el-table-column prop="running" label="进行中" width="80" />
      <el-table-column label="开擂时间" width="160">
        <template #default="{ row }">{{ fmtDate(new Date(row.createdAt).toISOString()) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="danger" @click="remove(row)">下架</el-button>
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
