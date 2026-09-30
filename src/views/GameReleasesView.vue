<script setup>
// 游戏版本：编辑器「导出独立版」出来的游戏，整个目录打成 zip 传上来，就成为该游戏的最新版。
// 玩家打开游戏时问服务器「最新是几版」，比自己新就弹窗提示下载。
// 版本号与游戏身份都烙在包里的 data/server.json，服务器照读、这里不让填——
// 填的号与包里的不一致，玩家装完仍自认旧版，每次启动都要再下一遍。
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { fmtBytes, fmtDate } from '../utils/format'

const loading = ref(false)
const rows = ref([])
const uploading = ref(false)
const progress = ref(0)
// 传完之后服务器登记的阶段（空 = 还在传）
const stage = ref('')
const fileInput = ref(null)
const lastResult = ref(null)
const lastError = ref('')

// 按游戏分组，组内新版在前。整包只留最新一版：旧版文件已清（archived），只留下载次数记录；
// 玩家会被推送的是第一个没清掉的那一版（全清了 = 这个游戏暂时没有可下载的版本）
const groups = computed(() => {
  const map = new Map()
  for (const r of rows.value) {
    if (!map.has(r.gameId)) map.set(r.gameId, [])
    map.get(r.gameId).push(r)
  }
  return [...map.entries()].map(([gameId, versions]) => ({
    gameId,
    title: versions[0].title,
    latest: versions.find((v) => !v.archived) || null,
    hasCampaign: versions.some((v) => v.hasCampaign),
    // 「Maker 也能联机」当前值（还没有战役 = null）
    makerVisible: versions.find((v) => v.makerVisible !== null && v.makerVisible !== undefined)?.makerVisible ?? null,
    versions,
    totalDownloads: versions.reduce((s, v) => s + (v.downloadCount || 0), 0),
  }))
})

async function load() {
  loading.value = true
  try {
    rows.value = (await api.gameReleases()).items
  } finally {
    loading.value = false
  }
}

function pick() {
  fileInput.value.value = ''
  fileInput.value.click()
}

// 「Maker 也能联机」必须每次明说，不给默认（ADR-0014 §7）：整包将来可能单独发行、只给游戏玩。
// 点「是」/「否」之外的地方关掉 = 不上传。
async function askMakerVisible(title) {
  try {
    await ElMessageBox.confirm(
      '导出的游戏永远能联机。要不要让 Maker（编辑器）玩家也能开桌、加入这个战役？<br>' +
        '是：服务器把游戏里的数据拆成战役包与素材传到存储，Maker 玩家按需下载。<br>' +
        '否：Maker 的战役列表与房间列表里看不到它，只有游戏里能联机。以后可以在这里随时改。',
      `${title}：Maker 也能联机吗？`,
      {
        confirmButtonText: '是，Maker 也能联机',
        cancelButtonText: '否，只给游戏',
        distinguishCancelAndClose: true,
        dangerouslyUseHTMLString: true, // 只有上面这段固定文字，不含用户输入
        type: 'info',
      },
    )
    return true
  } catch (action) {
    if (action === 'cancel') return false
    return null
  }
}

async function upload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.zip')) {
    ElMessage.error('请选择 zip 文件：导出的整个游戏目录（exe + data）打成的压缩包')
    return
  }
  const makerVisible = await askMakerVisible(file.name)
  if (makerVisible === null) return
  uploading.value = true
  progress.value = 0
  stage.value = ''
  lastResult.value = null
  lastError.value = ''
  try {
    const res = await api.uploadGamePackage(
      file,
      makerVisible,
      (sent, total) => {
        progress.value = Math.floor((sent * 100) / total)
      },
      (s) => {
        stage.value = s || '处理中'
      },
    )
    lastResult.value = res
    ElMessage.success(
      `「${res.title}」第 ${res.version} 版已成为最新版；战役管理${res.campaignCreated ? '已新建这条战役' : `已同步到第 ${res.version} 版`}`,
    )
    load()
  } catch (err) {
    lastError.value = err?.response?.data?.message || err?.response?.data?.error || '上传失败'
  } finally {
    uploading.value = false
    stage.value = ''
  }
}

// 「发布战役」：拿当前那一版整包补建战役（整包登记早于战役同步的老版本才会缺）
const publishing = ref('')
async function publishCampaign(g) {
  const makerVisible = await askMakerVisible(g.title)
  if (makerVisible === null) return
  publishing.value = g.gameId
  try {
    await api.publishGameCampaign(g.gameId, makerVisible)
    ElMessage.success(`「${g.title}」的战役已发布（第 ${g.latest.version} 版）`)
    load()
  } finally {
    publishing.value = ''
  }
}

// 事后改「Maker 也能联机」：关立刻生效（包删掉）；开要拿最新整包重新拆，服务器后台做，几十秒到几分钟
const switching = ref('')
const switchStage = ref('')
async function toggleMakerVisible(g, on) {
  try {
    await ElMessageBox.confirm(
      on
        ? `打开后，服务器会拿「${g.title}」最新一版整包拆出战役包与素材传到存储，Maker 玩家就能开桌、加入。继续？`
        : `关闭后，Maker 玩家看不到「${g.title}」、开不了桌也进不了桌；存储上的战役包删掉。游戏里联机不受影响。继续？`,
      'Maker 也能联机',
      { type: 'warning' },
    )
  } catch {
    return
  }
  switching.value = g.gameId
  switchStage.value = ''
  try {
    await api.setMakerVisible(g.gameId, on, (s) => (switchStage.value = s))
    ElMessage.success(on ? 'Maker 玩家现在也能联机了' : '已改为只给游戏联机')
    load()
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || '操作失败')
  } finally {
    switching.value = ''
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `删除「${row.title}」第 ${row.version} 版？删的若是最新版，上一版会重新成为最新版。`,
      '删除版本',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await api.deleteGameRelease(row.gameId, row.version)
  ElMessage.success('已删除')
  load()
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

onMounted(load)
</script>

<template>
  <div>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
      <template #title>
        在编辑器「导出独立版」时填好服务器地址与版本号（可勾「同时打一个 zip」），把 zip 传到这里就成为该游戏的最新版。
        版本号从包里读，不用填；比已有最新版还旧的包会被拒。玩家打开旧版游戏时会提示下载。
        只保留最新一版：传了新版，旧版的文件就清掉（只留下载次数记录）；战役管理里那条战役同时换成新版本。
        每次上传都要选「Maker 也能联机」：选否则只有导出的游戏能联机，Maker 里看不到；上传后也能随时用开关改。
      </template>
    </el-alert>

    <div class="page-toolbar">
      <input ref="fileInput" type="file" accept=".zip" style="display: none" @change="upload" />
      <el-button type="primary" :loading="uploading" @click="pick">上传新版本</el-button>
      <el-progress
        v-if="uploading && !stage"
        :percentage="progress"
        style="width: 280px"
      />
      <span v-if="uploading && stage" style="color: #909399">已传完，服务器正在处理：{{ stage }}……</span>
      <div class="spacer" />
      <el-button @click="load">刷新</el-button>
    </div>

    <el-alert
      v-if="lastError"
      type="error"
      :title="lastError"
      show-icon
      style="margin-bottom: 12px"
      @close="lastError = ''"
    />
    <el-alert
      v-if="lastResult"
      type="success"
      :title="`「${lastResult.title}」第 ${lastResult.version} 版（${fmtBytes(lastResult.size)}）已成为最新版，战役管理${lastResult.campaignCreated ? '已新建这条战役' : '已同步升级'}`"
      show-icon
      style="margin-bottom: 12px"
      @close="lastResult = null"
    />

    <el-empty v-if="!loading && groups.length === 0" description="还没有上传过游戏" />

    <el-card v-for="g in groups" :key="g.gameId" v-loading="loading" style="margin-bottom: 12px" shadow="never">
      <template #header>
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
          <strong>{{ g.title }}</strong>
          <el-tag v-if="g.latest" type="success">最新：第 {{ g.latest.version }} 版</el-tag>
          <el-tag v-else type="warning">暂无可下载的版本</el-tag>
          <el-tag v-if="g.hasCampaign" type="success" effect="plain">已发布战役</el-tag>
          <span v-if="g.hasCampaign" style="display: inline-flex; align-items: center; gap: 6px">
            Maker 也能联机
            <el-switch
              :model-value="!!g.makerVisible"
              :loading="switching === g.gameId"
              :disabled="!!switching || !g.latest"
              @change="(v) => toggleMakerVisible(g, v)"
            />
            <span v-if="switching === g.gameId && switchStage" style="color: #909399">{{ switchStage }}……</span>
          </span>
          <el-button
            v-else
            size="small"
            type="primary"
            :disabled="!g.latest"
            :loading="publishing === g.gameId"
            @click="publishCampaign(g)"
          >
            发布战役
          </el-button>
          <el-tag type="info">累计下载 {{ g.totalDownloads }} 次</el-tag>
          <span style="color: #909399; font-family: monospace">{{ g.gameId }}</span>
          <div class="spacer" style="flex: 1" />
          <!-- 地址由服务器给（文件在 R2 上，带内容哈希；换了新版地址就变）。全清了就没有可下载的版本 -->
          <el-button link type="primary" :disabled="!g.latest?.url" @click="copy(g.latest.url)">复制下载地址</el-button>
        </div>
      </template>
      <el-table :data="g.versions" border size="small" :row-style="({ row }) => (row.archived ? { color: '#a8abb2' } : {})">
        <el-table-column prop="version" label="版本" width="150">
          <template #default="{ row }">
            第 {{ row.version }} 版
            <el-tag v-if="row.archived" type="info" size="small">已清理</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="下载次数" width="110">
          <template #default="{ row }">{{ row.downloadCount || 0 }}</template>
        </el-table-column>
        <el-table-column label="大小" width="120">
          <template #default="{ row }">{{ fmtBytes(row.size) }}</template>
        </el-table-column>
        <el-table-column label="SHA-256" min-width="200">
          <template #default="{ row }">
            <span style="font-family: monospace; font-size: 12px">{{ row.sha256.slice(0, 16) }}…</span>
          </template>
        </el-table-column>
        <el-table-column label="上传时间" width="170">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
