"""B17 一次性跑手：提交 workflow + 打印服务端校验/执行错误 + 下载产物。

用法：python3 temp/b17-run.py <workflow.json> <上传图> <产物目录>
（submit-comfyui.py 不打印 400 的返回体，节点报错必须自己读）
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

HOST = 'http://192.168.1.16:8188'
wf_path, img_path, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
Path(out_dir).mkdir(parents=True, exist_ok=True)

bd = uuid.uuid4().hex
body = (f'--{bd}\r\nContent-Disposition: form-data; name="image"; filename="b17-src.png"\r\n'
        f'Content-Type: image/png\r\n\r\n').encode() + Path(img_path).read_bytes() + f'\r\n--{bd}--\r\n'.encode()
req = urllib.request.Request(HOST + '/upload/image', data=body,
                             headers={'Content-Type': f'multipart/form-data; boundary={bd}'})
urllib.request.urlopen(req, timeout=180).read()

wf = json.loads(Path(wf_path).read_text())
for n in wf.values():
    if n.get('class_type') == 'LoadImage':
        n['inputs']['image'] = 'b17-src.png'

req = urllib.request.Request(HOST + '/prompt',
                             data=json.dumps({'prompt': wf, 'client_id': 'b17'}).encode(),
                             headers={'Content-Type': 'application/json'})
try:
    pid = json.loads(urllib.request.urlopen(req, timeout=60).read())['prompt_id']
    print('queued', pid)
except urllib.error.HTTPError as e:
    print('校验失败 HTTP', e.code)
    print(e.read().decode()[:4000])
    sys.exit(1)

for _ in range(150):
    time.sleep(2)
    h = json.loads(urllib.request.urlopen(HOST + f'/history/{pid}', timeout=30).read())
    if pid in h:
        break
else:
    sys.exit('超时')

st = h[pid].get('status', {})
if st.get('status_str') == 'error':
    print('执行失败', json.dumps(st, ensure_ascii=False)[:3000])
    sys.exit(1)
print('status', st.get('status_str'))

n = 0
for node, out in h[pid]['outputs'].items():
    for im in out.get('images', []):
        q = urllib.parse.urlencode({k: im[k] for k in ('filename', 'subfolder', 'type')})
        raw = urllib.request.urlopen(HOST + f'/view?{q}', timeout=120).read()
        dst = Path(out_dir) / f"{node}-{im['filename']}"
        dst.write_bytes(raw)
        n += 1
        print(dst, len(raw), 'bytes')
print('产物', n, '个')
