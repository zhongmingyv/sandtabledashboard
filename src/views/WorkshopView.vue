<script setup>
// 创意工坊条目名单（ADR-0010 §11/§13）。
// 战役字节住 Steam，本服不在下载路径上，「不给曝光」拦不住违法内容——玩家能绕开游戏直接从
// Steam 网页订阅。唯一还起作用的位置是客户端装载之前那一问，问的就是这张表。
// 键是 Steam 条目 id 本身，不是本服的 Campaign 行：绕开游戏订阅的条目本服可能根本没有对应行。
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { fmtDate } from '../utils/format'

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const form = reactive({ itemId: '', reason: '' })
const submitting = ref(false)

function itemUrl(itemId) {
  return `https://steamcommunity.com/sharedfiles/filedetails/?id=${itemId}`
}

async function load() {
  loading.value = true
  try {
    const res = await api.workshopBans()
    rows.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}

async function ban() {
  const itemId = form.itemId.trim()
  if (!/^\d{1,20}$/.test(itemId) || itemId === '0') {
    ElMessage.error('条目 id 只能是十进制数字串（Steam PublishedFileId）')
    return
  }
  submitting.value = true
  try {
    const res = await api.banWorkshopItem(itemId, form.reason.trim())
    ElMessage.success(res.added ? '已加入名单' : '该条目已在名单上（未改写原记录）')
    form.itemId = ''
    form.reason = ''
    load()
  } finally {
    submitting.value = false
  }
}

async function unban(row) {
  try {
    await ElMessageBox.confirm(
      `解封条目 #${row.itemId}？解封后所有客户端将重新允许装载它的内容。`,
      '解封工坊条目',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await api.unbanWorkshopItem(row.itemId)
  ElMessage.success('已解封')
  load()
}

onMounted(load)
</script>

<template>
  <div>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
      <template #title>
        名单按 Steam 条目 id 生效，与本服有没有对应战役行无关。客户端在装载前问一次这张表；
        开房 / 加入 / 房间列表也各查一次（fail-closed）。置得上、撤得掉都留审计流水。
      </template>
    </el-alert>

    <div class="page-toolbar">
      <el-input
        v-model="form.itemId"
        placeholder="Steam 条目 id（纯数字）"
        clearable
        style="width: 200px"
        @keyup.enter="ban"
      />
      <el-input v-model="form.reason" placeholder="理由（≤500 字，进审计流水）" clearable style="width: 320px" @keyup.enter="ban" />
      <el-button type="danger" :loading="submitting" @click="ban">加入名单</el-button>
      <div class="spacer" />
      <el-button @click="load">刷新</el-button>
      <span style="color: #909399">共 {{ total }} 条</span>
    </div>

    <el-table :data="rows" v-loading="loading" border>
      <el-table-column prop="itemId" label="条目 id" width="180">
        <template #default="{ row }">
          <a :href="itemUrl(row.itemId)" target="_blank" rel="noopener">{{ row.itemId }}</a>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="理由" min-width="240" />
      <el-table-column prop="bannedBy" label="操作者" width="200" />
      <el-table-column prop="bannedAt" label="时间" width="170">
        <template #default="{ row }">{{ fmtDate(row.bannedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <el-button link type="success" @click="unban(row)">解封</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
