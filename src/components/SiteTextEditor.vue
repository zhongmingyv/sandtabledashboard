<script setup>
// 官网文字的四语编辑：简体、繁体、英文、日文各一页。写好简体点「AI 翻译」填其余三种，再手动改。
// 只有点按钮才翻译：改了简体不会把已经改好的译文冲掉。官网上某种语言没填时退回简体。
// modelValue = { zh: { name, text }, cht: {...}, en: {...}, ja: {...} }
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'

const props = defineProps({
  modelValue: { type: Object, required: true },
  nameLabel: { type: String, required: true },
  textLabel: { type: String, required: true },
  // 名字没填时显示什么（比如游戏原名、插件包里的名字）
  namePlaceholder: { type: String, default: '' },
  textPlaceholder: { type: String, default: '' },
})

const LANGS = [
  { key: 'zh', label: '简体中文' },
  { key: 'cht', label: '繁體中文' },
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' },
]
const FOREIGN = ['cht', 'en', 'ja']

const tab = ref('zh')
const busy = ref(false)

async function translate() {
  const v = props.modelValue
  if (!v.zh.name?.trim() && !v.zh.text?.trim()) {
    ElMessage.warning('先填写简体的内容')
    return
  }
  if (FOREIGN.some((k) => v[k].name?.trim() || v[k].text?.trim())) {
    try {
      await ElMessageBox.confirm('繁体、英文、日文已有内容，AI 翻译会覆盖它们。继续？', 'AI 翻译', { type: 'warning' })
    } catch {
      return
    }
  }
  busy.value = true
  try {
    const res = await api.translateSiteText(v.zh.name || '', v.zh.text || '')
    for (const k of FOREIGN) {
      v[k].name = res.translations[k]?.name || ''
      v[k].text = res.translations[k]?.text || ''
    }
    tab.value = 'en'
    ElMessage.success('翻译好了，看过之后记得保存')
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || 'AI 翻译失败，可以手动填写')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <el-tabs v-model="tab">
    <el-tab-pane v-for="l in LANGS" :key="l.key" :label="l.label" :name="l.key">
      <el-form label-position="top">
        <el-form-item :label="nameLabel">
          <el-input
            v-model="modelValue[l.key].name"
            maxlength="120"
            :placeholder="l.key === 'zh' ? namePlaceholder : '留空 = 显示简体的名字'"
          />
        </el-form-item>
        <el-form-item :label="textLabel">
          <el-input
            v-model="modelValue[l.key].text"
            type="textarea"
            :rows="7"
            maxlength="2000"
            show-word-limit
            :placeholder="l.key === 'zh' ? textPlaceholder : '留空 = 显示简体的内容'"
          />
        </el-form-item>
      </el-form>
    </el-tab-pane>
  </el-tabs>
  <el-button :loading="busy" @click="translate">{{ busy ? '翻译中，可能要一两分钟' : 'AI 翻译简体到其余语言' }}</el-button>
</template>
