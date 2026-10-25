"""The model server: the fine-tuned decision models behind one small HTTP API, on one GPU.

    GET  /health   -> {"models": {"d1_ft": {...}, "laya_ft": {...}}, "gpu": "..."}
    POST /decide   {"model": "d1_ft" | "laya_ft", "state": {...}, "questions": {id: question},
                    "images": ["data:image/png;base64,..."]}       (images: d1_ft only)
               -> {"answers": {id: answer}, "ms": 12.3}

The request is the same as one training row: the state and the typed questions in the Decision Index
schema (`lib/checks.ts` jevStateOf / jevQuestionOf). The answers are the models' own: a noul's P(yes),
or a choice with its probabilities. One request at a time per GPU: a lock keeps the calls in order.

The server listens on 127.0.0.1 only. The app reaches it through an SSH tunnel (scripts/verda/serve.sh).
Usage: python server.py --d1-lora d1-lora.pt --laya laya-ft [--port 8800]
"""
import argparse, base64, io, json, sys, threading, time, traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch
from PIL import Image

MODELS: dict = {}
INFO: dict = {}
LOCK = threading.Lock()


def load_d1(lora_path):
    from transformers import AutoModel
    from train_d1 import add_lora, merge_lora

    model = AutoModel.from_pretrained("LiquidAI/d1-3B", trust_remote_code=True, dtype=torch.bfloat16).to("cuda")
    saved = torch.load(lora_path)
    lm = model.model.language_model
    for name, lora in add_lora(lm, saved["rank"], saved["alpha"]).items():
        lora.A.data.copy_(saved["weights"][name]["A"])
        lora.B.data.copy_(saved["weights"][name]["B"])
    merge_lora(lm)
    model.eval()
    model.system_one({"warm": "up"}, {"q": {"type": "noul", "instructions": "Is this a test?"}})
    return lambda state, questions, images: model.system_one(state, questions, images=images or None)


def load_laya(path):
    import laya

    agent = laya.Agent(path, device="cuda")

    def run(state, questions, images):
        if images:
            raise ValueError("laya_ft reads text only")
        return agent.predict(state, questions)

    return run


def decode(image):
    data = image.split(",", 1)[1] if image.startswith("data:") else image
    return Image.open(io.BytesIO(base64.b64decode(data))).convert("RGB")


class Handler(BaseHTTPRequestHandler):
    def send(self, code, body):
        raw = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path != "/health":
            return self.send(404, {"error": "not found"})
        self.send(200, {"models": INFO, "gpu": torch.cuda.get_device_name(0)})

    def do_POST(self):
        if self.path != "/decide":
            return self.send(404, {"error": "not found"})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
            run = MODELS.get(req.get("model"))
            if run is None:
                return self.send(400, {"error": f"model {req.get('model')!r} is not loaded", "loaded": list(MODELS)})
            images = [decode(i) for i in req.get("images") or []]
            with LOCK:
                t0 = time.perf_counter()
                out = run(req["state"], req["questions"], images)
                torch.cuda.synchronize()
                ms = (time.perf_counter() - t0) * 1000
            self.send(200, {"answers": out["answers"], "ms": round(ms, 2)})
        except ValueError as e:
            self.send(400, {"error": str(e)})
        except Exception as e:  # keep serving after one bad request
            traceback.print_exc()
            self.send(500, {"error": f"{type(e).__name__}: {e}"})

    def log_message(self, fmt, *args):
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--d1-lora")
    ap.add_argument("--laya")
    ap.add_argument("--port", type=int, default=8800)
    args = ap.parse_args()
    for name, loader, arg, label in [("d1_ft", load_d1, args.d1_lora, "Liquid d1-3B + LoRA v1"), ("laya_ft", load_laya, args.laya, "Laya v6")]:
        if not arg:
            continue
        t0 = time.time()
        try:
            MODELS[name] = loader(arg)
            INFO[name] = {"label": label, "images": name == "d1_ft", "loaded_s": round(time.time() - t0, 1)}
            print(f"{name}: loaded in {time.time() - t0:.0f}s", flush=True)
        except Exception:  # serve the other model if one fails to load
            traceback.print_exc()
            INFO[name] = {"label": label, "error": "failed to load, see server.log"}
    if not MODELS:
        sys.exit("no model loaded")
    print(f"READY on 127.0.0.1:{args.port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
