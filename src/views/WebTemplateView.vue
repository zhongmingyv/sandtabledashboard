<script setup>
// 网页版模板：Maker 发版时打的 web-template.zip（Godot 网页引擎 + 预编译好的游戏代码），所有战役共用。
// 游戏数据不在模板里：玩家在官网「在线游戏」页点开一条战役，网页版按战役编号去下作者用 Maker「上传战役」
// 传上来、审核通过的那一版。所以这里只传一份文件，过审的战役自动都能玩；要不要先登录在「战役管理」里逐条设。
// 传上来先「待生效」，点「生效」才换上（一直不点的 keepDays 天后删）。推荐选打包出来的 web-template 文件夹：
// 浏览器把里面的文件直接传给 R2，不经服务器；zip 要服务器解开，只能经服务器中转（慢）。
// 换模板不立刻删旧的：上一版一直留着、随时一键回滚；更早的从被挤下去那刻起再留 keepDays 天才删。
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { fmtBytes, fmtDate } from '../utils/format'

const loading = ref(false)
const versions = ref([])
const keepDays = ref(7)
const uploading = ref(false)
const progress = ref(0)
// 进度条之外要显示的一句话（服务器处理到哪一步）；空 = 正在传，显示进度条
const stage = ref('')
const fileInput = ref(null)
const folderInput = ref(null)
const lastError = ref('')
const switching = ref('')

const current = computed(() => versions.value.find((v) => v.isCurrent) || null)

function apply(res) {
  versions.value = res.versions || []
  keepDays.value = res.keepDays || keepDays.value
}

async function load() {
  loading.value = true
  try {
    apply(await api.webTemplate())
  } finally {
    loading.value = false
  }
}

function pick() {
  fileInput.value.value = ''
  fileInput.value.click()
}

function pickFolder() {
  folderInput.value.value = ''
  folderInput.value.click()
}

// 引擎缺一样网页版就开不起来；服务器也查，这里先拦一下省得白传
const REQUIRED = ['index.html', 'index.js', 'index.wasm', 'index.pck']

// 选了文件夹：只要它最上面一层的文件，Godot 留下的 .import 旁注不要（同服务器解 zip 的规矩）
async function uploadFolder(e) {
  const files = [...(e.target.files || [])].filter(
    (f) => f.webkitRelativePath.split('/').length === 2 && !f.name.endsWith('.import'),
  )
  if (!files.length) return
  const missing = REQUIRED.filter((n) => !files.some((f) => f.name === n))
  if (missing.length) {
    ElMessage.error(`这个文件夹里缺 ${missing.join('、')}，请选打包出来的 web-template 文件夹`)
    return
  }
  await send((onProgress, onStage) => api.uploadWebTemplateDirect(files, onProgress, onStage))
}

async function upload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.zip')) {
    ElMessage.error('请选择 web-template.zip')
    return
  }
  await send((onProgress, onStage) => api.uploadWebTemplate(file, onProgress, onStage))
}

async function send(run) {
  uploading.value = true
  progress.value = 0
  stage.value = ''
  lastError.value = ''
  try {
    const res = await run(
      (sent, total) => {
        progress.value = Math.floor((sent * 100) / total)
      },
      (s) => {
        stage.value = s
      },
    )
    ElMessage.success(`模板 ${res.template.dir} 已传上去，待生效：在列表里点「生效」`)
    await load()
  } catch (err) {
    lastError.value = err?.response?.data?.message || err?.response?.data?.error || err?.message || '上传失败'
  } finally {
    uploading.value = false
    stage.value = ''
  }
}

// 上一版 = 没在用、也没定删除时间的那份
function isPrevious(v) {
  return !v.isCurrent && !v.expiresAt
}

function verbOf(v) {
  return v.pending ? '生效' : isPrevious(v) ? '回滚' : '切回'
}

async function activate(v) {
  const verb = v.pending ? '启用' : isPrevious(v) ? '回滚到' : '切回'
  try {
    await ElMessageBox.confirm(
      `${verb}模板 ${v.dir}（${fmtDate(v.createdAt)} 上传）？玩家下次打开就用它，已经开着的页面不受影响。` +
        `现在这份 ${current.value?.dir || ''} 留作上一版，随时可以再切回来。`,
      `${verb}这一版`,
      { type: 'warning', confirmButtonText: verb },
    )
  } catch {
    return
  }
  switching.value = v.dir
  try {
    apply(await api.activateWebTemplate(v.dir))
    ElMessage.success(`已${verb} ${v.dir}`)
  } catch (err) {
    ElMessage.error(err?.response?.data?.error || '切换失败')
    load()
  } finally {
    switching.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
      <template #title>
        传 Maker 发版时打的网页版模板（网页引擎 + 游戏代码，所有战役共用）：点「上传文件夹」选
        <code>property-editor-standalone/build/web-template</code>，浏览器直接传给 R2、不经服务器（传 zip 要经服务器中转，慢）。
        传上来先「待生效」，玩家看不到；点「生效」才换上，一直不点的 {{ keepDays }} 天后删掉。
        换了新的不会立刻删旧的：<b>上一版一直留着，出了问题点「回滚」</b>；再早的从被挤下去那刻起留 {{ keepDays }} 天后自动删。
        游戏数据不用传：审核通过的战役自动出现在官网「在线游戏」页，玩家点开时网页版按战役去下作者「上传战役」传的那一版。
        要不要先登录在「战役管理」里逐条设。官方 exe 游戏（卖的那几款）不在网页版里。
        R2 桶要配 CORS（允许 GET），否则网页版卡在加载，部署后跑 <code>--check-r2</code> 查。
      </template>
    </el-alert>

    <div class="page-toolbar">
      <input ref="fileInput" type="file" accept=".zip" style="display: none" @change="upload" />
      <input ref="folderInput" type="file" webkitdirectory style="display: none" @change="uploadFolder" />
      <el-button type="primary" :loading="uploading" @click="pickFolder">上传文件夹</el-button>
      <el-button :disabled="uploading" @click="pick">上传 zip（经服务器，慢）</el-button>
      <el-progress v-if="uploading && !stage" :percentage="progress" style="width: 280px" />
      <span v-if="uploading && stage" style="color: #909399">{{ stage }}……</span>
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

    <el-card v-loading="loading" shadow="never">
      <el-empty v-if="!versions.length" description="还没有上传过模板：官网「在线游戏」页暂时一个都玩不了" />
      <el-table v-else :data="versions" row-key="dir">
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.isCurrent" type="success">正在用</el-tag>
            <el-tag v-else-if="row.pending" type="warning">待生效</el-tag>
            <el-tag v-else-if="isPrevious(row)">上一版</el-tag>
            <el-tag v-else type="info">待删除</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="版本标识" width="110">
          <template #default="{ row }"><span style="font-family: monospace">{{ row.dir }}</span></template>
        </el-table-column>
        <el-table-column label="大小" width="100">
          <template #default="{ row }">{{ fmtBytes(row.size) }}</template>
        </el-table-column>
        <el-table-column label="上传时间" width="150">
          <template #default="{ row }">{{ fmtDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="换下时间" width="150">
          <template #default="{ row }">{{ row.isCurrent || row.pending ? '-' : fmtDate(row.retiredAt) }}</template>
        </el-table-column>
        <el-table-column label="删除时间" width="150">
          <template #default="{ row }">{{ row.expiresAt ? fmtDate(row.expiresAt) : '不删' }}</template>
        </el-table-column>
        <el-table-column label="文件" min-width="200">
          <template #default="{ row }">
            <span style="font-family: monospace; font-size: 12px">{{ row.files.join('  ') }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="!row.isCurrent"
              :type="row.pending ? 'primary' : isPrevious(row) ? 'warning' : 'default'"
              size="small"
              :loading="switching === row.dir"
              @click="activate(row)"
            >
              {{ verbOf(row) }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
