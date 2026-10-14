// 素材分类的中文名（ADR-0016 §2）：取值由 Maker 推出来（AssetUsages / LibraryFilters），服务器只限形状。
// 「资源库审核」与「素材管理」两页共用；不认识的值原样显示。

export const kinds = { image: '图片', sound: '声音', music: '音乐', video: '视频' }

export const layers = {
  background: '背景', height: '高度', terrain: '地形', edge: '边', road: '路', object: '对象',
  region: '区域', ui: 'UI', effect: '特效', other: '其它',
}

export const modes = { image: '图片', random: '随机', chain: '接龙', connect: '连接件', anim: '序列帧', water: '水面' }

// 挂得上图片 / 视频的 UI 组件种类（UiComponentKind 的小写名）
export const uiKinds = {
  image: '图像', sprite: '序列帧', backdrop: '底框', button: '按钮', progressbar: '进度条', scrollbox: '滚动框', video: '视频',
}

/** 一种用法 → 「地形·随机」「UI·按钮」 */
export function usageText(u) {
  let t = layers[u.layer] || u.layer
  if (u.mode) t += '·' + (modes[u.mode] || u.mode)
  if (u.ui) t += '·' + (uiKinds[u.ui] || u.ui)
  return t
}
