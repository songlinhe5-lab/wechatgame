#!/usr/bin/env python3
"""本地 ComfyUI · qwen-image-2.1 指令编辑（对照云端 qwen-image-3.0）。

本机权重（官方模板口径，docs.comfy.org/zh/tutorials/image/qwen/qwen-image-2-1）：
  UNETLoader  qwen_image_2.1_int8_convrot.safetensors
  CLIPLoader  qwen3vl_8b_int8_convrot.safetensors   type=qwen_image   ← 真正的文本编码器
  VAELoader   qwen_image_2.1_vae_bf16.safetensors
⚠️ qwen3.5_9b_qwen_image_2.1_pe_i2i 是「提示词增强(PE)」模型，不是条件编码器；
   早前误接进 CLIPLoader 是出噪声的根因。
编辑入口是 TextEncodeQwenImage21：images 走 COMFY_AUTOGROW_V3，可挂最多 16 张refer图，
同时吐 positive / negative / latent 三路（latent 已按 resolution 对齐，直接喂 KSampler）。

官方采样口径：steps 25 / cfg 1.0 / euler / simple / denoise 1.0；resolution=0 保持 image_1 原尺寸。

工具优先级（用户口径）：本地 Qwen-2.1 → 云端 qwen-image-3.0 → 万相 wan2.7 bbox_list（0.5 元/次，仅当前两者解决不了一致性时）。

用法：python3 games/beads/design/ai-workflows/local-qwen-masked.py <提示词文件> <输出名> [resolution] [steps] [cfg] [seed] [mode] [denoise] [mask路径]
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import uuid

HOST = 'http://192.168.1.16:8188'
REPO = '/Users/stephenhe/Development/workspace/wechatgame'
WORK = REPO + '/temp/online-inpaint'
SRC = os.environ.get('LQ_SRC') or REPO + '/temp/comfy-cut/src.png'
NAME = 'lq_src.png'
MASK = REPO + '/temp/comfy-cut/mask_ui_union.png'
MASK_NAME = 'lq_mask_ui.png'

NEG = '模糊, 色块, 轮廓残影, 变形, 文字错误, 低质量, 水印'


def post_json(path, payload):
    req = urllib.request.Request(HOST + path, data=json.dumps(payload).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def upload(path, name):
    boundary = '----lq' + uuid.uuid4().hex
    body = ('--%s\r\nContent-Disposition: form-data; name="image"; filename="%s"\r\n'
            'Content-Type: image/png\r\n\r\n' % (boundary, name)).encode()
    body += open(path, 'rb').read()
    body += ('\r\n--%s\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue'
             '\r\n--%s--\r\n' % (boundary, boundary)).encode()
    req = urllib.request.Request(HOST + '/upload/image', data=body,
                                 headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())


def build(prompt, resolution, steps, cfg, seed, mode, denoise=1.0, mask_name=MASK_NAME):
    """mode:
    edit    TextEncodeQwenImageEditPlus + VAEEncode 底图 + denoise 1.0（整图重画）
    masked  同上 + SetLatentNoiseMask(五件联合 mask) + 指定 denoise（局部重绘，替代 ControlNet 路线）
    """
    nodes = {
        '1': {'class_type': 'UNETLoader',
              'inputs': {'unet_name': 'qwen_image_2.1_int8_convrot.safetensors',
                         'weight_dtype': 'default'}},
        '2': {'class_type': 'CLIPLoader',
              'inputs': {'clip_name': 'qwen3vl_8b_int8_convrot.safetensors',
                         'type': 'qwen_image'}},
        '3': {'class_type': 'VAELoader',
              'inputs': {'vae_name': 'qwen_image_2.1_vae_bf16.safetensors'}},
        '4': {'class_type': 'LoadImage', 'inputs': {'image': NAME}},
        '5': {'class_type': 'TextEncodeQwenImageEditPlus',
              'inputs': {'clip': ['2', 0], 'prompt': prompt, 'vae': ['3', 0],
                         'image1': ['4', 0]}},
        '6': {'class_type': 'VAEEncode', 'inputs': {'pixels': ['4', 0], 'vae': ['3', 0]}},
        '7': {'class_type': 'KSampler',
              'inputs': {'model': ['1', 0], 'seed': seed, 'steps': steps, 'cfg': cfg,
                         'sampler_name': 'euler', 'scheduler': 'simple',
                         'positive': ['5', 0], 'negative': ['5', 0],
                         'latent_image': ['6', 0], 'denoise': denoise}},
        '8': {'class_type': 'VAEDecode',
              'inputs': {'samples': ['7', 0], 'vae': ['3', 0]}},
        '9': {'class_type': 'SaveImage',
              'inputs': {'images': ['8', 0], 'filename_prefix': 'lq_out'}},
    }
    if mode == 'masked':
        # LoadImage 的 MASK 输出取的是 alpha 通道，灰度 PNG 会得到全 0 → 必须走 ImageToMask 取 red 通道。
        # SetLatentNoiseMask：白=可变区（按 denoise 重绘），黑=锁死原图
        nodes['10'] = {'class_type': 'LoadImage', 'inputs': {'image': mask_name}}
        nodes['10b'] = {'class_type': 'ImageToMask',
                        'inputs': {'image': ['10', 0], 'channel': 'red'}}
        nodes['11'] = {'class_type': 'SetLatentNoiseMask',
                       'inputs': {'samples': ['6', 0], 'mask': ['10b', 0]}}
        nodes['7']['inputs']['latent_image'] = ['11', 0]
    return nodes


def main():
    pf, tag = sys.argv[1], sys.argv[2]
    resolution = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    steps = int(sys.argv[4]) if len(sys.argv) > 4 else 25
    cfg = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
    seed = int(sys.argv[6]) if len(sys.argv) > 6 else 42
    mode = sys.argv[7] if len(sys.argv) > 7 else 'edit'
    denoise = float(sys.argv[8]) if len(sys.argv) > 8 else 1.0
    mask_path = sys.argv[9] if len(sys.argv) > 9 else MASK
    mask_name = MASK_NAME if mask_path == MASK else 'lq_mask_custom.png'
    prompt = open(pf).read().strip()

    upload(SRC, NAME)
    if mode == 'masked':
        upload(mask_path, mask_name)
    print('上传 %s → %s' % (SRC, NAME))
    print('参数 steps=%d cfg=%.1f seed=%d mode=%s denoise=%.2f'
          % (steps, cfg, seed, mode, denoise))

    pid = post_json('/prompt', {'prompt': build(prompt, resolution, steps, cfg, seed, mode,
                                                denoise, mask_name),
                                'client_id': uuid.uuid4().hex})['prompt_id']
    t0 = time.time()
    while True:
        time.sleep(4)
        try:
            with urllib.request.urlopen(HOST + '/history/' + pid, timeout=60) as r:
                hist = json.loads(r.read())
        except Exception as e:
            # 单卡显存吃紧时整台 ComfyUI 会假死十几分钟，HTTP 直接超时。
            # ⛔ 不能因此抛异常退出：任务在服务端仍在跑，退出就白等（2026-10-31 实跑踩到）。
            print('  轮询超时，继续等（%s）%ds' % (type(e).__name__, time.time() - t0))
            if time.time() - t0 > 2400:
                print('超时，任务可能已完成：curl /history/%s 取文件名后走 /view 下载' % pid)
                return
            continue
        if pid not in hist:
            if time.time() - t0 > 1800:
                print('超时')
                return
            print('  ...%ds' % (time.time() - t0))
            continue
        st = hist[pid].get('status', {})
        print('status', st.get('status_str'), 'elapsed %.0fs' % (time.time() - t0))
        if st.get('status_str') == 'error':
            for m in st.get('messages', []):
                if m[0] == 'execution_error':
                    d = m[1]
                    print('ERROR node', d.get('node_id'), d.get('node_type'))
                    print(d.get('exception_message', '')[:600])
            return
        for v in hist[pid]['outputs'].values():
            for im in v.get('images', []):
                q = urllib.parse.urlencode({'filename': im['filename'],
                                            'subfolder': im.get('subfolder', ''),
                                            'type': im.get('type', 'output')})
                with urllib.request.urlopen(HOST + '/view?' + q, timeout=180) as r:
                    data = r.read()
                dst = '%s/%s.png' % (WORK, tag)
                open(dst, 'wb').write(data)
                from PIL import Image
                print('saved', dst.replace(REPO + '/', ''), Image.open(dst).size,
                      len(data) // 1024, 'KB')
        return


main()
