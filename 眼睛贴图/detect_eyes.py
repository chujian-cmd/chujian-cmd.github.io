import onnxruntime as ort
import numpy as np
from PIL import Image
import base64, io

MODEL = "face_detection_yunet_2023mar.onnx"
IMG_B64 = "selfie_b64.txt"
INPUT_SIZE = 640
CONF_THRESH = 0.9

sess = ort.InferenceSession(MODEL)
input_name = sess.get_inputs()[0].name
out_names = [o.name for o in sess.get_outputs()]

b64 = open(IMG_B64).read().strip()
if "," in b64: b64 = b64.split(",",1)[1]
img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
W, H = img.size
arr = np.asarray(img.resize((INPUT_SIZE, INPUT_SIZE)), dtype=np.float32)
arr = arr.transpose(2,0,1)[None]

outs = sess.run(out_names, {input_name: arr})
d = dict(zip(out_names, outs))

strides = [8, 16, 32]
boxes, scores, kpss = [], [], []

for s in strides:
    cls = d[f"cls_{s}"][0]
    obj = d[f"obj_{s}"][0]
    bbox = d[f"bbox_{s}"][0]
    kps = d[f"kps_{s}"][0]
    score = np.sqrt(np.clip(cls,0,1) * np.clip(obj,0,1)).flatten()
    fw = INPUT_SIZE // s
    for idx in range(len(score)):
        if score[idx] < CONF_THRESH: continue
        row, col = idx // fw, idx % fw
        cx = (col + bbox[idx][0]) * s
        cy = (row + bbox[idx][1]) * s
        w  = np.exp(bbox[idx][2]) * s
        h  = np.exp(bbox[idx][3]) * s
        boxes.append([cx-w/2, cy-h/2, cx+w/2, cy+h/2])
        scores.append(score[idx])
        kp = kps[idx].reshape(5,2)
        kpss.append([((col+dx)*s, (row+dy)*s) for dx,dy in kp])

def nms(boxes, scores, thr=0.3):
    idx = np.argsort(scores)[::-1]
    keep = []
    while len(idx):
        i = idx[0]; keep.append(i)
        if len(idx)==1: break
        rest = idx[1:]
        xx1 = np.maximum(boxes[i][0], boxes[rest][:,0])
        yy1 = np.maximum(boxes[i][1], boxes[rest][:,1])
        xx2 = np.minimum(boxes[i][2], boxes[rest][:,2])
        yy2 = np.minimum(boxes[i][3], boxes[rest][:,3])
        inter = np.maximum(0, xx2-xx1) * np.maximum(0, yy2-yy1)
        ai = (boxes[i][2]-boxes[i][0])*(boxes[i][3]-boxes[i][1])
        ar = (boxes[rest][:,2]-boxes[rest][:,0])*(boxes[rest][:,3]-boxes[rest][:,1])
        iou = inter / (ai + ar - inter + 1e-6)
        idx = rest[iou < thr]
    return keep

if boxes:
    boxes = np.array(boxes)
    scores = np.array(scores)
    keep = nms(boxes, scores)
    sx, sy = W/INPUT_SIZE, H/INPUT_SIZE
    for i in keep:
        kp = kpss[i]
        rx, ry = kp[0][0]*sx, kp[0][1]*sy
        lx, ly = kp[1][0]*sx, kp[1][1]*sy
        print(f"右眼: ({rx:.0f}, {ry:.0f})  左眼: ({lx:.0f}, {ly:.0f})  置信度: {scores[i]:.3f}")
else:
    print("未检测到人脸，试试降低 CONF_THRESH")
