import cv2, numpy as np, base64, sys

MODEL_PATH = "face_detection_yunet_2023mar.onnx"

IMAGE_B64 = """
__IMAGE_B64__
"""

STICKER_B64 = """
__STICKER_B64__
"""

def load_b64(b64, flags):
    b64 = b64.strip()
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    return cv2.imdecode(np.frombuffer(base64.b64decode(b64), np.uint8), flags)

detector = cv2.FaceDetectorYN.create(MODEL_PATH, "", (320, 320), score_threshold=0.9)
img = load_b64(IMAGE_B64, cv2.IMREAD_COLOR)
sticker = load_b64(STICKER_B64, cv2.IMREAD_UNCHANGED)
h, w = img.shape[:2]
detector.setInputSize((w, h))

_, faces = detector.detect(img)
if faces is None:
    sys.exit("未检测到人脸")

for face in faces:
    right_eye = np.array([face[4], face[5]], dtype=np.float32)
    left_eye  = np.array([face[6], face[7]], dtype=np.float32)
    center = (right_eye + left_eye) / 2.0
    dx, dy = right_eye - left_eye
    angle = np.degrees(np.arctan2(dy, dx))
    eye_dist = np.linalg.norm(right_eye - left_eye)

    target_w = max(1, int(eye_dist * 1.6))
    scale = target_w / sticker.shape[1]
    target_h = max(1, int(sticker.shape[0] * scale))
    st = cv2.resize(sticker, (target_w, target_h), interpolation=cv2.INTER_AREA)

    M = cv2.getRotationMatrix2D((target_w / 2.0, target_h / 2.0), angle, 1.0)
    M[0, 2] += center[0] - target_w / 2.0
    M[1, 2] += center[1] - target_h / 2.0

    if st.shape[2] == 4:
        rgb = st[:, :, :3].astype(np.float32)
        alpha = st[:, :, 3:4].astype(np.float32) / 255.0
    else:
        rgb = st.astype(np.float32)
        alpha = np.ones((st.shape[0], st.shape[1], 1), dtype=np.float32)

    warped_rgb = cv2.warpAffine(rgb, M, (w, h))
    warped_a = cv2.warpAffine(alpha, M, (w, h))

    mask = warped_a > 0
    img = img.astype(np.float32)
    for c in range(3):
        img[:, :, c] = np.where(
            mask[:, :, 0],
            img[:, :, c] * (1 - warped_a[:, :, 0]) + warped_rgb[:, :, c] * warped_a[:, :, 0],
            img[:, :, c]
        )
    img = np.clip(img, 0, 255).astype(np.uint8)

cv2.imwrite("output.jpg", img)
print("完成 → output.jpg")
