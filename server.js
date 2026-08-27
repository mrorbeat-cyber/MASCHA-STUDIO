import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const DATA_FILE = path.join(__dirname, "usage.json");
const DEFAULT_CAP = Number(process.env.MONTHLY_CAP_USD || 10);

function monthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`;
}
function readUsage() {
  try {
    const v = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (v.month !== monthKey()) return { month: monthKey(), spent: 0, cap: DEFAULT_CAP };
    return { month: v.month, spent: Number(v.spent||0), cap: Number(v.cap||DEFAULT_CAP) };
  } catch {
    return { month: monthKey(), spent: 0, cap: DEFAULT_CAP };
  }
}
function writeUsage(v) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(v, null, 2));
}

// Conservative app-side estimates. These are not OpenAI billing records.
// They exist only to enforce the user's MASCHA STUDIO spending guard.
const ESTIMATES = {
  preview: 0.04,
  final: 0.14
};
function estimate(mode) {
  return mode === "final" ? ESTIMATES.final : ESTIMATES.preview;
}

app.get("/api/status", (req,res) => {
  const u = readUsage();
  res.json({
    ok: true,
    month: u.month,
    spent: +u.spent.toFixed(2),
    cap: +u.cap.toFixed(2),
    remaining: +Math.max(0, u.cap-u.spent).toFixed(2),
    estimates: ESTIMATES
  });
});

app.post("/api/cap", (req,res) => {
  const cap = Number(req.body?.cap);
  if (!Number.isFinite(cap) || cap < 0 || cap > 500) {
    return res.status(400).json({error:"Límite inválido."});
  }
  const u = readUsage();
  u.cap = cap;
  writeUsage(u);
  res.json({ok:true, cap:u.cap});
});

app.post("/api/generate", upload.single("image"), async (req,res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error:"Falta OPENAI_API_KEY en el servidor. La interfaz está lista, pero la API aún no está autorizada."
      });
    }

    const prompt = String(req.body?.prompt || "").trim();
    const mode = req.body?.mode === "final" ? "final" : "preview";
    if (!prompt) return res.status(400).json({error:"Escribe una solicitud."});

    const u = readUsage();
    const estimated = estimate(mode);
    if (u.spent + estimated > u.cap + 1e-9) {
      return res.status(402).json({
        error:`Tope mensual alcanzado. Saldo interno disponible: $${Math.max(0,u.cap-u.spent).toFixed(2)}.`
      });
    }

    const fullPrompt = [
      "Create a professional Print on Demand commercial visual.",
      "Follow the user's request precisely.",
      "Use polished advertising-studio lighting, realistic shadows, depth, clean hierarchy and current commercial aesthetics.",
      "Do not add unrelated text, logos, watermarks or extra products unless explicitly requested.",
      "If an input image is supplied, preserve its important visual identity and incorporate it faithfully into the requested product/scene.",
      `USER REQUEST: ${prompt}`
    ].join("\n");

    let apiResp;
    if (req.file) {
      const fd = new FormData();
      fd.append("model", "gpt-image-2");
      fd.append("prompt", fullPrompt);
      fd.append("size", "1024x1024");
      fd.append("quality", mode === "final" ? "high" : "low");
      const blob = new Blob([req.file.buffer], {type:req.file.mimetype || "image/png"});
      fd.append("image", blob, req.file.originalname || "input.png");

      apiResp = await fetch("https://api.openai.com/v1/images/edits", {
        method:"POST",
        headers:{ Authorization:`Bearer ${process.env.OPENAI_API_KEY}` },
        body:fd
      });
    } else {
      apiResp = await fetch("https://api.openai.com/v1/images/generations", {
        method:"POST",
        headers:{
          Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          model:"gpt-image-2",
          prompt:fullPrompt,
          size:"1024x1024",
          quality: mode === "final" ? "high" : "low"
        })
      });
    }

    const body = await apiResp.json();
    if (!apiResp.ok) {
      return res.status(apiResp.status).json({
        error: body?.error?.message || "La API de imágenes devolvió un error."
      });
    }

    const item = body?.data?.[0];
    const image = item?.b64_json
      ? `data:image/png;base64,${item.b64_json}`
      : item?.url;

    if (!image) return res.status(502).json({error:"La API no devolvió una imagen utilizable."});

    u.spent = +(u.spent + estimated).toFixed(4);
    writeUsage(u);

    res.json({
      ok:true,
      image,
      mode,
      chargedEstimate:estimated,
      usage:{
        spent:+u.spent.toFixed(2),
        cap:+u.cap.toFixed(2),
        remaining:+Math.max(0,u.cap-u.spent).toFixed(2)
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({error:"Error interno al generar la imagen."});
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`MASCHA STUDIO listo en http://localhost:${port}`));
