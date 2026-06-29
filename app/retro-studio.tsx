"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent, DragEvent, MouseEvent } from "react";

type Tone = {
  id: string;
  label: string;
  ink: [number, number, number];
  paper: string;
  swatch: string;
};

const tones: Tone[] = [
  {
    id: "ink",
    label: "먹색",
    ink: [41, 38, 32],
    paper: "#f5f1e3",
    swatch: "#292620",
  },
  {
    id: "sepia",
    label: "세피아",
    ink: [117, 73, 39],
    paper: "#f8f0db",
    swatch: "#754927",
  },
  {
    id: "teal",
    label: "청록",
    ink: [28, 95, 101],
    paper: "#eef2e7",
    swatch: "#1c5f65",
  },
  {
    id: "red",
    label: "적판",
    ink: [131, 48, 61],
    paper: "#f5ecdf",
    swatch: "#83303d",
  },
  {
    id: "color",
    label: "원본",
    ink: [35, 34, 29],
    paper: "#f4f0df",
    swatch: "linear-gradient(135deg, #7d2f3b, #1f6970 50%, #c49a4c)",
  },
];

const sampleUrl =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 680">
      <defs>
        <linearGradient id="paper" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#f7efd9"/>
          <stop offset="1" stop-color="#dbe8e2"/>
        </linearGradient>
        <linearGradient id="face" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#d89466"/>
          <stop offset="1" stop-color="#7a4e2d"/>
        </linearGradient>
      </defs>
      <rect width="900" height="680" fill="url(#paper)"/>
      <rect x="80" y="70" width="740" height="540" fill="#ece5cf"/>
      <circle cx="450" cy="275" r="130" fill="url(#face)"/>
      <path d="M245 610c34-126 138-210 205-210s171 84 205 210z" fill="#1f6970"/>
      <path d="M292 176c64-112 244-122 317 0 33 55 18 119-10 155-46-74-244-74-290 0-33-44-46-98-17-155z" fill="#2a261f"/>
      <circle cx="404" cy="276" r="16" fill="#24201a"/>
      <circle cx="496" cy="276" r="16" fill="#24201a"/>
      <path d="M406 345c30 22 63 22 91 0" fill="none" stroke="#24201a" stroke-width="14" stroke-linecap="round"/>
      <rect x="110" y="96" width="160" height="22" fill="#8d3440"/>
      <rect x="110" y="135" width="230" height="12" fill="#24201a" opacity=".55"/>
      <rect x="612" y="96" width="180" height="18" fill="#24201a" opacity=".55"/>
      <rect x="612" y="128" width="126" height="12" fill="#24201a" opacity=".45"/>
    </svg>
  `);

function clamp(value: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}

function mixChannel(source: number, target: number, amount: number) {
  return Math.round(source * (1 - amount) + target * amount);
}

export default function RetroStudio() {
  const [imageSrc, setImageSrc] = useState(sampleUrl);
  const [fileName, setFileName] = useState("샘플 프레임");
  const [dotSize, setDotSize] = useState(9);
  const [toneId, setToneId] = useState("sepia");
  const [toneAmount, setToneAmount] = useState(78);
  const [inkDensity, setInkDensity] = useState(88);
  const [isDragging, setIsDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageUrlRef = useRef<string | null>(null);

  const activeTone = useMemo(
    () => tones.find((item) => item.id === toneId) ?? tones[1],
    [toneId],
  );

  const renderImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1180 / image.naturalWidth);
      const width = Math.max(320, Math.round(image.naturalWidth * scale));
      const height = Math.max(240, Math.round(image.naturalHeight * scale));
      const sourceCanvas = document.createElement("canvas");
      const sourceContext = sourceCanvas.getContext("2d", {
        willReadFrequently: true,
      });
      const context = canvas.getContext("2d");

      if (!sourceContext || !context) {
        setError("캔버스를 준비하지 못했습니다.");
        return;
      }

      const densityFactor = inkDensity / 100;
      const toneFactor = activeTone.id === "color" ? 0 : toneAmount / 100;

      sourceCanvas.width = width;
      sourceCanvas.height = height;
      canvas.width = width;
      canvas.height = height;

      sourceContext.drawImage(image, 0, 0, width, height);
      const imageData = sourceContext.getImageData(0, 0, width, height);
      const data = imageData.data;

      context.fillStyle = activeTone.paper;
      context.fillRect(0, 0, width, height);

      context.globalAlpha = 0.25;
      for (let y = 0; y < height; y += 26) {
        context.fillStyle = y % 52 === 0 ? "#16130f" : "#645c4d";
        context.fillRect(0, y, width, 1);
      }

      context.globalAlpha = 1;

      for (let y = 0; y < height; y += dotSize) {
        for (let x = 0; x < width; x += dotSize) {
          let red = 0;
          let green = 0;
          let blue = 0;
          let alpha = 0;
          let samples = 0;

          const blockHeight = Math.min(dotSize, height - y);
          const blockWidth = Math.min(dotSize, width - x);

          for (let blockY = 0; blockY < blockHeight; blockY += 1) {
            for (let blockX = 0; blockX < blockWidth; blockX += 1) {
              const index = ((y + blockY) * width + (x + blockX)) * 4;
              red += data[index];
              green += data[index + 1];
              blue += data[index + 2];
              alpha += data[index + 3];
              samples += 1;
            }
          }

          red /= samples;
          green /= samples;
          blue /= samples;
          alpha /= samples;

          if (alpha < 8) {
            continue;
          }

          const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
          const density = clamp((1 - luminance) * densityFactor, 0, 1);
          const radius = Math.max(0.35, dotSize * 0.56 * density);

          if (radius < 0.55) {
            continue;
          }

          const printRed =
            activeTone.id === "color"
              ? clamp(red * 0.78 + 28)
              : mixChannel(red, activeTone.ink[0], toneFactor);
          const printGreen =
            activeTone.id === "color"
              ? clamp(green * 0.78 + 28)
              : mixChannel(green, activeTone.ink[1], toneFactor);
          const printBlue =
            activeTone.id === "color"
              ? clamp(blue * 0.78 + 28)
              : mixChannel(blue, activeTone.ink[2], toneFactor);

          context.beginPath();
          context.fillStyle = `rgba(${printRed}, ${printGreen}, ${printBlue}, ${Math.min(
            0.96,
            density + 0.28,
          )})`;
          context.arc(
            x + blockWidth / 2,
            y + blockHeight / 2,
            radius,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      }

      const texture = context.getImageData(0, 0, width, height);
      for (let index = 0; index < texture.data.length; index += 4) {
        const grain = ((index * 17 + width * 13) % 19) - 9;
        texture.data[index] = clamp(texture.data[index] + grain);
        texture.data[index + 1] = clamp(texture.data[index + 1] + grain);
        texture.data[index + 2] = clamp(texture.data[index + 2] + grain);
      }
      context.putImageData(texture, 0, 0);

      context.strokeStyle = "rgba(36, 32, 26, 0.32)";
      context.lineWidth = Math.max(1, Math.round(width / 420));
      context.strokeRect(0.5, 0.5, width - 1, height - 1);

      setIsReady(true);
      setError("");
    };

    image.onerror = () => {
      setError("이미지를 불러오지 못했습니다.");
      setIsReady(false);
    };

    image.src = imageSrc;
  }, [activeTone, dotSize, imageSrc, inkDensity, toneAmount]);

  useEffect(() => {
    renderImage();
  }, [renderImage]);

  useEffect(() => {
    return () => {
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
      }
    };
  }, []);

  function handleFile(file?: File) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 사용할 수 있습니다.");
      return;
    }

    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
    }

    const nextUrl = URL.createObjectURL(file);
    imageUrlRef.current = nextUrl;
    setImageSrc(nextUrl);
    setFileName(file.name);
    setIsReady(false);
    setError("");
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files[0]);
  }

  function openPicker(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    inputRef.current?.click();
  }

  function resetSample() {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }

    setImageSrc(sampleUrl);
    setFileName("샘플 프레임");
    setDotSize(9);
    setToneId("sepia");
    setToneAmount(78);
    setInkDensity(88);
    setError("");
  }

  function downloadImage() {
    const canvas = canvasRef.current;
    if (!canvas || !isReady) {
      return;
    }

    const link = document.createElement("a");
    link.download = `retro-photo-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const dottedPreviewStyle = {
    "--dot": `${dotSize * 1.7}px`,
    "--ink": activeTone.swatch,
  } as CSSProperties;

  return (
    <main className="min-h-screen bg-[#f3f0e6] text-[#24201a]">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-5 px-4 py-4 lg:grid-cols-[330px_1fr] lg:px-7">
        <aside className="flex flex-col gap-4">
          <div className="border border-[#24201a] bg-[#fbf7e9] p-5 shadow-[5px_5px_0_#24201a]">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#7d2f3b]">
              Retro Studio
            </p>
            <h1 className="mt-3 text-4xl font-black leading-none sm:text-5xl">
              레트로 사진관
            </h1>
          </div>

          <label
            className={`flex min-h-36 cursor-pointer flex-col justify-between border border-dashed p-4 transition ${
              isDragging
                ? "border-[#1f6970] bg-[#dcece7]"
                : "border-[#24201a] bg-[#faf6e8]"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            <span className="text-sm font-bold">이미지 업로드</span>
            <span className="break-all text-base font-semibold leading-6">
              {fileName}
            </span>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={onInputChange}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              className="border border-[#24201a] bg-[#24201a] px-3 py-3 text-sm font-bold text-[#fbf7e9] transition hover:bg-[#3a352c] disabled:cursor-not-allowed disabled:opacity-45"
              type="button"
              onClick={openPicker}
            >
              선택
            </button>
            <button
              className="border border-[#24201a] bg-[#fbf7e9] px-3 py-3 text-sm font-bold transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
              type="button"
              onClick={downloadImage}
              disabled={!isReady}
            >
              저장
            </button>
          </div>

          <div className="border border-[#24201a] bg-white/70 p-4">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-bold" htmlFor="dot-size">
                도트 크기
              </label>
              <output className="font-mono text-sm">{dotSize}px</output>
            </div>
            <input
              id="dot-size"
              className="mt-3 w-full accent-[#7d2f3b]"
              type="range"
              min="4"
              max="28"
              value={dotSize}
              onChange={(event) => setDotSize(Number(event.target.value))}
            />
          </div>

          <div className="border border-[#24201a] bg-white/70 p-4">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-bold" htmlFor="tone-amount">
                컬러톤 농도
              </label>
              <output className="font-mono text-sm">{toneAmount}%</output>
            </div>
            <input
              id="tone-amount"
              className="mt-3 w-full accent-[#1f6970]"
              type="range"
              min="0"
              max="100"
              value={toneAmount}
              onChange={(event) => setToneAmount(Number(event.target.value))}
            />
          </div>

          <div className="border border-[#24201a] bg-white/70 p-4">
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm font-bold" htmlFor="ink-density">
                잉크 밀도
              </label>
              <output className="font-mono text-sm">{inkDensity}%</output>
            </div>
            <input
              id="ink-density"
              className="mt-3 w-full accent-[#7d2f3b]"
              type="range"
              min="45"
              max="125"
              value={inkDensity}
              onChange={(event) => setInkDensity(Number(event.target.value))}
            />
          </div>

          <div className="border border-[#24201a] bg-white/70 p-4">
            <p className="text-sm font-bold">컬러톤</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {tones.map((item) => (
                <button
                  key={item.id}
                  className={`flex min-h-10 items-center gap-2 border px-3 py-2 text-sm font-semibold transition ${
                    item.id === activeTone.id
                      ? "border-[#24201a] bg-[#24201a] text-[#fbf7e9]"
                      : "border-[#9b917e] bg-[#fbf7e9] hover:border-[#24201a]"
                  }`}
                  type="button"
                  onClick={() => setToneId(item.id)}
                >
                  <span
                    className="h-4 w-4 shrink-0 border border-black/25"
                    style={{ background: item.swatch }}
                  />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            className="border border-[#24201a] bg-[#fbf7e9] px-3 py-3 text-sm font-bold transition hover:bg-white"
            type="button"
            onClick={resetSample}
          >
            초기화
          </button>

          {error ? (
            <p className="border border-[#8d3440] bg-[#f7e6e0] p-3 text-sm font-semibold text-[#7d2f3b]">
              {error}
            </p>
          ) : null}
        </aside>

        <section className="grid min-h-[620px] place-items-center border border-[#24201a] bg-[#dfe8df] p-3 shadow-[8px_8px_0_#24201a] md:p-5">
          <div className="newspaper-sheet w-full max-w-5xl border border-[#24201a] bg-[#fbf7e9] p-3 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24201a] pb-3">
              <span className="font-mono text-xs uppercase tracking-[0.24em]">
                Dot Proof
              </span>
              <span className="text-sm font-bold">
                {activeTone.label} / {dotSize}px / {inkDensity}%
              </span>
            </div>
            <div
              className="preview-grid mt-4 grid min-h-[360px] place-items-center overflow-hidden border border-[#24201a] bg-[#f8f2df] p-2"
              style={dottedPreviewStyle}
            >
              <canvas
                ref={canvasRef}
                className="block h-auto max-h-[72vh] w-auto max-w-full bg-[#f8f2df] shadow-[0_0_0_1px_rgba(36,32,26,.3)]"
              />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
