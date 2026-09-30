<script setup>
// 战役审核（ADR-0014 §9）：作者用 Maker 发布的每一版都先进「待审」，通过了其他玩家才看得到、才能开桌；
// 审核期间已上架的旧版照常可用。驳回要填理由——作者在 Maker 的上传窗口里看得到。
// 素材（图 / 声 / 乐）按内容哈希存在存储上，同一张图被多个战役引用只存一份；封禁一个素材 = 所有引用它的战役里它都消失。
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { fmtBytes, fmtDate } from '../utils/format'

const status = ref('pending')
const loading = ref(false)
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const drawer = ref(false)
const detail = ref(null)
const detailLoading = ref(false)
const acting = ref(false)
// 点过「试听」的音频才挂 <audio>，免得一打开详情就连一串音频地址
const audioOn = reactive({})

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp']
const AUDIO_EXT = ['.ogg', '.mp3', '.wav']

async function load() {
  loading.value = true
  try {
    const res = await api.reviewRevisions({ status: status.value, page: page.value })
    rows.value = res.items
    total.value = res.total
    pageSize.value = res.pageSize
  } finally {
    loading.value = false
  }
}

watch(status, () => {
  page.value = 1
  load()
})

async function open(row) {
  drawer.value = true
  detail.value = null
  detailLoading.value = true
  for (const k of Object.keys(audioOn)) delete audioOn[k]
  try {
    detail.value = { ...(await api.reviewRevision(row.revisionId)), hasLiveVersion: row.hasLiveVersion }
  } finally {
    detailLoading.value = false
  }
}

function parseList(json, key) {
  try {
    const arr = JSON.parse(json || '[]')
    return Array.isArray(arr) ? arr.map((x) => x?.[key] || x?.id || x?.levelId || '').filter(Boolean) : []
  } catch {
    return []
  }
}

async function approve() {
  const d = detail.value
  try {
    await ElMessageBox.confirm(
      `放行「${d.title}」第 ${d.gameVersion} 版？放行后所有玩家都能看到、下载、开桌。`,
      '放行',
      { type: 'success' },
    )
  } catch {
    return
  }
  acting.value = true
  try {
    await api.approveCampaign(d.campaignId)
    ElMessage.success('已放行')
    drawer.value = false
    load()
  } finally {
    acting.value = false
  }
}

async function reject(block) {
  const d = detail.value
  let reason
  try {
    ;({ value: reason } = await ElMessageBox.prompt(
      block
        ? '驳回并封禁整个战役（违法内容用）：已下载的玩家也不能再加载它，只能在「战役管理」里解封。'
        : d.hasLiveVersion
          ? '驳回这一版。已上架的旧版照常可用。理由会显示给作者。'
          : '驳回这一版。理由会显示给作者。',
      block ? '驳回并封禁' : '驳回',
      {
        inputPlaceholder: '驳回理由（作者看得到）',
        inputValidator: (v) => (v && v.trim().length > 0 && v.trim().length <= 500) || '请填写 1~500 字的理由',
        type: block ? 'error' : 'warning',
      },
    ))
  } catch {
    return
  }
  acting.value = true
  try {
    await api.rejectCampaign(d.campaignId, reason.trim(), block)
    ElMessage.success(block ? '已驳回并封禁' : '已驳回')
    drawer.value = false
    load()
  } finally {
    acting.value = false
  }
}

async function banAsset(a) {
  try {
    await ElMessageBox.confirm(
      '封禁这个素材？文件立刻从存储删除，所有引用它的战役里它都会消失（缺图空白、缺音静默），以后也不许再传。',
      '封禁素材',
      { type: 'error' },
    )
  } catch {
    return
  }
  await api.banCampaignAsset(a.sha256)
  a.isBanned = true
  a.url = null
  ElMessage.success('已封禁')
}

function kindOf(a) {
  if (IMAGE_EXT.includes(a.ext)) return 'image'
  if (AUDIO_EXT.includes(a.ext)) return 'audio'
  return 'other'
}

onMounted(load)
</script>

<template>
  <div>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
      <template #title>
        作者用 Maker 发布的每一版都要在这里审核，通过后其他玩家才看得到、才能开桌；审核期间已上架的旧版照常可用。
        驳回要填理由，作者在 Maker 里看得到。官方试玩账号在 Maker 里审的也记在这里。
      </template>
    </el-alert>

    <div class="page-toolbar">
      <el-radio-group v-model="status">
        <el-radio-button value="pending">待审核</el-radio-button>
        <el-radio-button value="rejected">已驳回</el-radio-button>
        <el-radio-button value="approved">已通过</el-radio-button>
      </el-radio-group>
      <div class="spacer" />
      <el-button @click="load">刷新</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" border size="small" @row-click="open" style="cursor: pointer">
      <el-table-column label="战役" min-width="180">
        <template #default="{ row }">
          <strong>{{ row.title }}</strong>
          <el-tag v-if="row.hasLiveVersion" size="small" type="success" effect="plain" style="margin-left: 6px">
            有已上架版本
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="作者" width="140">
        <template #default="{ row }">{{ row.ownerName }}</template>
      </el-table-column>
      <el-table-column label="版本" width="90">
        <template #default="{ row }">第 {{ row.gameVersion }} 版</template>
      </el-table-column>
      <el-table-column label="大小（包 + 素材）" width="150">
        <template #default="{ row }">{{ fmtBytes(row.size) }} + {{ fmtBytes(row.assetsBytes) }}</template>
      </el-table-column>
      <el-table-column label="创意工坊" width="110">
        <template #default="{ row }">
          <el-tag v-if="row.workshopItemId" size="small">已发工坊</el-tag>
          <span v-else style="color: #c0c4cc">—</span>
        </template>
      </el-table-column>
      <el-table-column v-if="status === 'rejected'" label="驳回理由" min-width="160">
        <template #default="{ row }">{{ row.rejectReason }}</template>
      </el-table-column>
      <el-table-column label="提交时间" width="170">
        <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="total > pageSize"
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="total, prev, pager, next"
      style="margin-top: 12px"
      @current-change="load"
    />

    <el-drawer v-model="drawer" size="60%" :title="detail ? `${detail.title} · 第 ${detail.gameVersion} 版` : '详情'">
      <div v-loading="detailLoading">
        <template v-if="detail">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="作者">{{ detail.ownerName }}</el-descriptions-item>
            <el-descriptions-item label="年代">{{ detail.era || '—' }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              {{ { pending: '待审核', rejected: '已驳回', approved: '已通过' }[detail.status] || detail.status }}
            </el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ fmtDate(detail.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="阵营">{{ parseList(detail.factionsJson, 'name').join('、') || '—' }}</el-descriptions-item>
            <el-descriptions-item label="关卡">{{ parseList(detail.levelsJson, 'name').join('、') || '—' }}</el-descriptions-item>
            <el-descriptions-item label="包">
              {{ fmtBytes(detail.size) }}
              <el-link v-if="detail.packageUrl" :href="detail.packageUrl" type="primary" style="margin-left: 8px">下载包</el-link>
            </el-descriptions-item>
            <el-descriptions-item label="创意工坊">
              <el-link
                v-if="detail.workshopItemId"
                :href="`https://steamcommunity.com/sharedfiles/filedetails/?id=${detail.workshopItemId}`"
                target="_blank"
                type="primary"
              >
                {{ detail.workshopItemId }}
              </el-link>
              <span v-else>—</span>
            </el-descriptions-item>
            <el-descriptions-item v-if="detail.rejectReason" label="驳回理由" :span="2">{{ detail.rejectReason }}</el-descriptions-item>
          </el-descriptions>

          <div v-if="detail.status !== 'approved'" style="margin: 16px 0; display: flex; gap: 8px">
            <el-button type="success" :loading="acting" @click="approve">放行</el-button>
            <el-button v-if="detail.status === 'pending'" type="warning" :loading="acting" @click="reject(false)">驳回</el-button>
            <el-button type="danger" plain :loading="acting" @click="reject(true)">驳回并封禁战役</el-button>
          </div>

          <h4>素材（{{ detail.assets.length }}）</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 12px">
            <div
              v-for="a in detail.assets"
              :key="a.sha256"
              style="width: 150px; border: 1px solid #ebeef5; border-radius: 4px; padding: 6px; font-size: 12px"
            >
              <div style="height: 110px; display: flex; align-items: center; justify-content: center; background: #f5f7fa">
                <span v-if="a.isBanned" style="color: #f56c6c">已封禁</span>
                <el-image
                  v-else-if="kindOf(a) === 'image' && a.url"
                  :src="a.url"
                  :preview-src-list="[a.url]"
                  fit="contain"
                  style="width: 100%; height: 100%"
                  preview-teleported
                />
                <template v-else-if="kindOf(a) === 'audio' && a.url">
                  <audio v-if="audioOn[a.sha256]" :src="a.url" controls style="width: 140px" />
                  <el-button v-else size="small" @click="audioOn[a.sha256] = true">试听</el-button>
                </template>
                <el-link v-else-if="a.url" :href="a.url" type="primary">下载{{ a.ext }}</el-link>
              </div>
              <div style="margin-top: 4px; word-break: break-all" :title="a.refs.join('\n')">
                {{ a.refs[0] || a.sha256.slice(0, 12) }}<span v-if="a.refs.length > 1"> 等 {{ a.refs.length }} 处</span>
              </div>
              <div style="color: #909399">{{ fmtBytes(a.size) }}</div>
              <el-button v-if="!a.isBanned" link type="danger" size="small" @click="banAsset(a)">封禁素材</el-button>
            </div>
          </div>

          <h4>包里的文件</h4>
          <el-table v-if="detail.entries" :data="detail.entries" size="small" border max-height="320">
            <el-table-column prop="name" label="文件" />
            <el-table-column label="大小" width="120">
              <template #default="{ row }">{{ fmtBytes(row.size) }}</template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="包太大或已删除，未列出" />
        </template>
      </div>
    </el-drawer>
  </div>
</template>
