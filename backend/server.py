"""
Air Vision — YOLOv8 Vehicle Detection Backend
Flask server providing MJPEG video streams and real-time detection stats.
"""

from flask import Flask, Response, request, jsonify, send_from_directory
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import time
import threading
import os
import uuid

app = Flask(__name__)
CORS(app)

# ===================== CONFIGURATION & SCIENTIFIC CONSTANTS =====================
PIXEL_TO_METER = 0.05

EMISSION_FACTORS = {
    "car": {"CO2": 120.0, "PM2.5": 0.025, "NOx": 0.4},
    "motorcycle": {"CO2": 70.0, "PM2.5": 0.015, "NOx": 0.15},
    "bus": {"CO2": 800.0, "PM2.5": 0.18, "NOx": 5.2},
    "truck": {"CO2": 950.0, "PM2.5": 0.22, "NOx": 6.8}
}

VEHICLE_COLORS = {
    "car": (52, 214, 122),       # Green
    "motorcycle": (0, 178, 255), # Cyan
    "bus": (241, 196, 15),       # Yellow
    "truck": (230, 126, 34)      # Orange
}

TREES_COUNT = 8
CO2_ABSORPTION_RATE = 0.00069
PM_ABSORPTION_RATE = 0.00000047

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


class EnvironmentalAuditor:
    """YOLOv8-based vehicle detection with environmental emission tracking."""

    def __init__(self, model_path="yolov8n.pt"):
        self.model = YOLO(model_path)
        self.start_time = time.time()
        self.is_running = False

        # Tracking & Stats
        self.track_history = {}
        self.stats = {k: {"count": 0, "dist": 0.0, "co2": 0.0, "pm25": 0.0, "nox": 0.0}
                      for k in EMISSION_FACTORS.keys()}
        self.total_absorbed_co2 = 0.0
        self.total_absorbed_pm = 0.0
        self.frame_count = 0
        self.fps = 0.0
        self._fps_start = time.time()
        self._fps_count = 0
        self.active_vehicles = 0
        self.lock = threading.Lock()

    def reset(self):
        """Reset all tracking data for a new session."""
        with self.lock:
            self.start_time = time.time()
            self.track_history = {}
            self.stats = {k: {"count": 0, "dist": 0.0, "co2": 0.0, "pm25": 0.0, "nox": 0.0}
                          for k in EMISSION_FACTORS.keys()}
            self.total_absorbed_co2 = 0.0
            self.total_absorbed_pm = 0.0
            self.frame_count = 0
            self.fps = 0.0
            self._fps_start = time.time()
            self._fps_count = 0
            self.active_vehicles = 0

    def get_vsp_multiplier(self, speed_kmh):
        """Vehicle Specific Power Multiplier: Accounts for idling vs cruising."""
        if speed_kmh < 5:
            return 2.8
        if speed_kmh < 25:
            return 1.5
        if speed_kmh < 60:
            return 1.0
        return 1.4

    def update(self, frame):
        """Process a single frame through YOLOv8 and return annotated frame."""
        self.frame_count += 1
        self._fps_count += 1

        # Calculate FPS every second
        elapsed_fps = time.time() - self._fps_start
        if elapsed_fps >= 1.0:
            self.fps = self._fps_count / elapsed_fps
            self._fps_count = 0
            self._fps_start = time.time()

        results = self.model.track(frame, persist=True, conf=0.45, verbose=False,
                                   tracker="bytetrack.yaml")
        current_time = time.time()
        elapsed = current_time - self.start_time

        # Calculate Environment Absorption
        self.total_absorbed_co2 = TREES_COUNT * CO2_ABSORPTION_RATE * elapsed
        self.total_absorbed_pm = TREES_COUNT * PM_ABSORPTION_RATE * elapsed

        current_active = 0

        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            ids = results[0].boxes.id.cpu().numpy().astype(int)
            clss = results[0].boxes.cls.cpu().numpy().astype(int)
            confs = results[0].boxes.conf.cpu().numpy()

            current_active = len(ids)

            for box, tid, cls, conf in zip(boxes, ids, clss, confs):
                label = self.model.names[cls]
                if label not in EMISSION_FACTORS:
                    continue

                with self.lock:
                    if tid not in self.track_history:
                        self.stats[label]["count"] += 1
                        self.track_history[tid] = {
                            "pos": ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2),
                            "time": current_time,
                            "speed": 0,
                            "label": label
                        }
                        speed_kmh = 0
                    else:
                        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
                        prev_cx, prev_cy = self.track_history[tid]["pos"]
                        dt = current_time - self.track_history[tid]["time"]

                        speed_kmh = self.track_history[tid]["speed"]
                        if dt > 0.1:
                            px_dist = np.sqrt((cx - prev_cx) ** 2 + (cy - prev_cy) ** 2)
                            meters = px_dist * PIXEL_TO_METER
                            km = meters / 1000
                            speed_kmh = (meters / dt) * 3.6

                            mult = self.get_vsp_multiplier(speed_kmh)
                            self.stats[label]["dist"] += meters
                            self.stats[label]["co2"] += EMISSION_FACTORS[label]["CO2"] * km * mult
                            self.stats[label]["pm25"] += EMISSION_FACTORS[label]["PM2.5"] * km * mult
                            self.stats[label]["nox"] += EMISSION_FACTORS[label]["NOx"] * km * mult

                            self.track_history[tid] = {
                                "pos": (cx, cy),
                                "time": current_time,
                                "speed": speed_kmh,
                                "label": label
                            }

                # Draw bounding box
                x1, y1, x2, y2 = map(int, box)
                color_bgr = VEHICLE_COLORS.get(label, (52, 214, 122))
                color_bgr_cv = (color_bgr[2], color_bgr[1], color_bgr[0])

                # Draw box with rounded corners effect
                cv2.rectangle(frame, (x1, y1), (x2, y2), color_bgr_cv, 2)

                # Corner accents
                corner_len = min(15, (x2 - x1) // 4, (y2 - y1) // 4)
                cv2.line(frame, (x1, y1), (x1 + corner_len, y1), color_bgr_cv, 3)
                cv2.line(frame, (x1, y1), (x1, y1 + corner_len), color_bgr_cv, 3)
                cv2.line(frame, (x2, y1), (x2 - corner_len, y1), color_bgr_cv, 3)
                cv2.line(frame, (x2, y1), (x2, y1 + corner_len), color_bgr_cv, 3)
                cv2.line(frame, (x1, y2), (x1 + corner_len, y2), color_bgr_cv, 3)
                cv2.line(frame, (x1, y2), (x1, y2 - corner_len), color_bgr_cv, 3)
                cv2.line(frame, (x2, y2), (x2 - corner_len, y2), color_bgr_cv, 3)
                cv2.line(frame, (x2, y2), (x2, y2 - corner_len), color_bgr_cv, 3)

                # Label tag
                tag = f"{label.upper()} {int(conf * 100)}% {int(speed_kmh)}km/h"
                (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
                cv2.rectangle(frame, (x1, y1 - th - 10), (x1 + tw + 8, y1), color_bgr_cv, -1)
                cv2.putText(frame, tag, (x1 + 4, y1 - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1, cv2.LINE_AA)

        self.active_vehicles = current_active
        return frame

    def get_stats(self):
        """Return current detection statistics as a dict."""
        with self.lock:
            total_co2 = sum(v["co2"] for v in self.stats.values())
            total_pm25 = sum(v["pm25"] for v in self.stats.values())
            total_nox = sum(v["nox"] for v in self.stats.values())
            total_vehicles = sum(v["count"] for v in self.stats.values())
            net_co2 = total_co2 - self.total_absorbed_co2

            # AQI Impact
            aqi_impact = "LOW"
            if total_pm25 > self.total_absorbed_pm * 10:
                aqi_impact = "MODERATE"
            if total_pm25 > self.total_absorbed_pm * 50:
                aqi_impact = "HIGH"

            elapsed = time.time() - self.start_time

            return {
                "session_duration": round(elapsed, 1),
                "fps": round(self.fps, 1),
                "frame_count": self.frame_count,
                "active_vehicles": self.active_vehicles,
                "total_vehicles": total_vehicles,
                "vehicles": {
                    "car": self.stats["car"]["count"],
                    "motorcycle": self.stats["motorcycle"]["count"],
                    "bus": self.stats["bus"]["count"],
                    "truck": self.stats["truck"]["count"]
                },
                "emissions": {
                    "co2_emitted": round(total_co2, 4),
                    "pm25_emitted": round(total_pm25, 6),
                    "nox_emitted": round(total_nox, 4),
                    "co2_absorbed": round(self.total_absorbed_co2, 6),
                    "pm_absorbed": round(self.total_absorbed_pm, 8),
                    "net_co2": round(net_co2, 4),
                    "trees_count": TREES_COUNT,
                    "aqi_impact": aqi_impact,
                    "remediation_hours": max(0, int((total_co2 / 0.00069) / 3600)) if total_co2 > 0 else 0
                },
                "breakdown": {
                    label: {
                        "count": v["count"],
                        "distance_m": round(v["dist"], 1),
                        "co2_g": round(v["co2"], 4),
                        "pm25_g": round(v["pm25"], 6)
                    }
                    for label, v in self.stats.items()
                }
            }


# ===================== GLOBAL STATE =====================
auditor = EnvironmentalAuditor()
capture_lock = threading.Lock()
active_capture = None
stream_mode = None  # 'live' or 'upload'
upload_file_path = None


def generate_live_stream():
    """Generator for live webcam MJPEG stream."""
    global active_capture, stream_mode
    with capture_lock:
        if active_capture is not None:
            active_capture.release()
        active_capture = cv2.VideoCapture(0)
        stream_mode = 'live'

    auditor.reset()
    auditor.is_running = True

    try:
        while auditor.is_running and active_capture.isOpened():
            success, frame = active_capture.read()
            if not success:
                break

            processed = auditor.update(frame)
            _, buffer = cv2.imencode('.jpg', processed, [cv2.IMWRITE_JPEG_QUALITY, 80])
            frame_bytes = buffer.tobytes()

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    finally:
        with capture_lock:
            if active_capture is not None:
                active_capture.release()
                active_capture = None


def generate_upload_stream(file_path):
    """Generator for uploaded file MJPEG stream."""
    global active_capture, stream_mode
    with capture_lock:
        if active_capture is not None:
            active_capture.release()
        active_capture = cv2.VideoCapture(file_path)
        stream_mode = 'upload'

    auditor.reset()
    auditor.is_running = True

    # Check if it's an image (single frame)
    ext = os.path.splitext(file_path)[1].lower()
    is_image = ext in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']

    try:
        if is_image:
            frame = cv2.imread(file_path)
            if frame is not None:
                processed = auditor.update(frame)
                _, buffer = cv2.imencode('.jpg', processed, [cv2.IMWRITE_JPEG_QUALITY, 85])
                frame_bytes = buffer.tobytes()
                # Send the image frame multiple times so it stays visible
                for _ in range(30):
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                    time.sleep(0.1)
        else:
            # Video file
            fps = active_capture.get(cv2.CAP_PROP_FPS) or 30
            delay = 1.0 / fps

            while auditor.is_running and active_capture.isOpened():
                success, frame = active_capture.read()
                if not success:
                    # Loop back to start or stop
                    break

                processed = auditor.update(frame)
                _, buffer = cv2.imencode('.jpg', processed, [cv2.IMWRITE_JPEG_QUALITY, 80])
                frame_bytes = buffer.tobytes()

                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

                time.sleep(delay * 0.5)  # Slightly faster than real-time
    finally:
        with capture_lock:
            if active_capture is not None:
                active_capture.release()
                active_capture = None
        auditor.is_running = False


# ===================== ROUTES =====================

@app.route('/')
def index():
    """Serve the main detection page."""
    return send_from_directory(os.path.join(os.path.dirname(__file__), '..'), 'vehicle-detection.html')


@app.route('/api/live-stream')
def live_stream():
    """Start live webcam detection stream."""
    return Response(generate_live_stream(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file upload and return the file ID."""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    # Save with unique name
    ext = os.path.splitext(file.filename)[1].lower()
    allowed = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.jpg', '.jpeg', '.png', '.bmp', '.webp']
    if ext not in allowed:
        return jsonify({"error": f"Unsupported file type: {ext}"}), 400

    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    global upload_file_path
    upload_file_path = filepath

    return jsonify({"file_id": file_id, "filename": file.filename, "path": filepath})


@app.route('/api/upload-stream')
def upload_stream():
    """Stream the uploaded file with detection."""
    global upload_file_path
    if upload_file_path is None or not os.path.exists(upload_file_path):
        return jsonify({"error": "No file uploaded"}), 400

    return Response(generate_upload_stream(upload_file_path),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/api/stats')
def get_stats():
    """Return current detection statistics."""
    return jsonify(auditor.get_stats())


@app.route('/api/stop', methods=['POST'])
def stop_detection():
    """Stop the current detection session."""
    global active_capture
    auditor.is_running = False
    with capture_lock:
        if active_capture is not None:
            active_capture.release()
            active_capture = None
    return jsonify({"status": "stopped", "summary": auditor.get_stats()})


@app.route('/api/status')
def get_status():
    """Return server status."""
    return jsonify({
        "running": auditor.is_running,
        "mode": stream_mode,
        "model": "YOLOv8n",
        "server": "Air Vision Detection Backend v1.0"
    })


# Serve static files from parent directory
@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(os.path.join(os.path.dirname(__file__), '..'), filename)


if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("🌿 Air Vision — YOLOv8 Detection Server")
    print("=" * 60)
    print("📡 Server:     http://localhost:5000")
    print("📹 Live:       http://localhost:5000/api/live-stream")
    print("📊 Stats:      http://localhost:5000/api/stats")
    print("🌐 Frontend:   http://localhost:5000/vehicle-detection.html")
    print("=" * 60 + "\n")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
