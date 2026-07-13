'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, MouseEvent } from 'react';

type Tone = {
    id: string;
    label: string;
    ink: [number, number, number];
    paper: string;
    swatch: string;
};

type DotShape = 'circle' | 'square';

type CameraStatus = 'checking' | 'available' | 'unavailable';

const tones: Tone[] = [
    {
        id: 'ink',
        label: '먹색',
        ink: [41, 38, 32],
        paper: '#f5f1e3',
        swatch: '#292620',
    },
    {
        id: 'sepia',
        label: '세피아',
        ink: [117, 73, 39],
        paper: '#f8f0db',
        swatch: '#754927',
    },
    {
        id: 'teal',
        label: '청록',
        ink: [28, 95, 101],
        paper: '#eef2e7',
        swatch: '#1c5f65',
    },
    {
        id: 'red',
        label: '적판',
        ink: [131, 48, 61],
        paper: '#f5ecdf',
        swatch: '#83303d',
    },
    {
        id: 'color',
        label: '원본',
        ink: [35, 34, 29],
        paper: '#f4f0df',
        swatch: 'linear-gradient(135deg, #7d2f3b, #1f6970 50%, #c49a4c)',
    },
];

const sampleUrl =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900">
      <rect width="900" height="900" fill="#f5f1e3"/>
      <text x="450" y="750" font-size="700" text-anchor="middle">😊</text>
    </svg>
  `);

function clamp(value: number, min = 0, max = 255) {
    return Math.max(min, Math.min(max, value));
}

function mixChannel(source: number, target: number, amount: number) {
    return Math.round(source * (1 - amount) + target * amount);
}

function isMobileLikeDevice() {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;

    return (
        /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(userAgent) ||
        (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
}

export default function RetroStudio() {
    const [imageSrc, setImageSrc] = useState(sampleUrl);
    const [fileName, setFileName] = useState('');
    const [dotSize, setDotSize] = useState(6);
    const [dotShape, setDotShape] = useState<DotShape>('circle');
    const [toneId, setToneId] = useState('ink');
    const [toneAmount, setToneAmount] = useState(100);
    const [inkDensity, setInkDensity] = useState(110);
    const [outputWidth, setOutputWidth] = useState(1200);
    const [maxOutputWidth, setMaxOutputWidth] = useState(4000);
    const [isDragging, setIsDragging] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [cameraStatus, setCameraStatus] = useState<CameraStatus>('checking');
    const [error, setError] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const imageUrlRef = useRef<string | null>(null);

    const activeTone = useMemo(() => tones.find((item) => item.id === toneId) ?? tones[1], [toneId]);

    const renderImage = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const image = new Image();
        image.onload = () => {
            const natW = image.naturalWidth;
            const natH = image.naturalHeight;
            setMaxOutputWidth(Math.min(natW, 2400));
            if (outputWidth > natW) {
                setOutputWidth(Math.min(natW, 2400));
            }
            const scale = Math.min(1, outputWidth / natW);
            const width = Math.max(320, Math.round(natW * scale));
            const height = Math.max(320, Math.round(natH * scale));
            const sourceCanvas = document.createElement('canvas');
            const sourceContext = sourceCanvas.getContext('2d', {
                willReadFrequently: true,
            });
            const context = canvas.getContext('2d');

            if (!sourceContext || !context) {
                setError('캔버스를 준비하지 못했습니다.');
                return;
            }

            const densityFactor = inkDensity / 100;
            const toneFactor = activeTone.id === 'color' ? 0 : toneAmount / 100;

            sourceCanvas.width = width;
            sourceCanvas.height = height;
            canvas.width = width;
            canvas.height = height;

            sourceContext.drawImage(image, 0, 0, width, height);
            const imageData = sourceContext.getImageData(0, 0, width, height);
            const data = imageData.data;

            context.fillStyle = activeTone.paper;
            context.fillRect(0, 0, width, height);

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
                        activeTone.id === 'color'
                            ? clamp(red * 0.78 + 28)
                            : mixChannel(red, activeTone.ink[0], toneFactor);
                    const printGreen =
                        activeTone.id === 'color'
                            ? clamp(green * 0.78 + 28)
                            : mixChannel(green, activeTone.ink[1], toneFactor);
                    const printBlue =
                        activeTone.id === 'color'
                            ? clamp(blue * 0.78 + 28)
                            : mixChannel(blue, activeTone.ink[2], toneFactor);

                    context.beginPath();
                    context.fillStyle = `rgba(${printRed}, ${printGreen}, ${printBlue}, ${Math.min(
                        0.96,
                        density + 0.28
                    )})`;

                    if (dotShape === 'square') {
                        const size = radius * 1.72;
                        context.fillRect(x + blockWidth / 2 - size / 2, y + blockHeight / 2 - size / 2, size, size);
                        continue;
                    }

                    context.arc(x + blockWidth / 2, y + blockHeight / 2, radius, 0, Math.PI * 2);
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

            setIsReady(true);
            setError('');
        };

        image.onerror = () => {
            setError('이미지를 불러오지 못했습니다.');
            setIsReady(false);
        };

        image.src = imageSrc;
    }, [activeTone, dotShape, dotSize, imageSrc, inkDensity, outputWidth, toneAmount]);

    useEffect(() => {
        renderImage();
    }, [renderImage]);

    useEffect(() => {
        const animationFrame = window.requestAnimationFrame(() => {
            const probe = document.createElement('input');
            probe.type = 'file';
            probe.accept = 'image/*';

            const supportsCaptureInput = 'capture' in probe;
            const canUseMobileCapture = supportsCaptureInput && isMobileLikeDevice();

            setCameraStatus(canUseMobileCapture ? 'available' : 'unavailable');
        });

        return () => window.cancelAnimationFrame(animationFrame);
    }, []);

    useEffect(() => {
        return () => {
            if (imageUrlRef.current) {
                URL.revokeObjectURL(imageUrlRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isOptionsOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setIsOptionsOpen(false);
            }
        }

        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isOptionsOpen]);

    function handleFile(file?: File) {
        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            setError('이미지 파일만 사용할 수 있습니다.');
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
        setError('');
        setOutputWidth(999999);
    }

    function onInputChange(event: ChangeEvent<HTMLInputElement>) {
        handleFile(event.target.files?.[0]);
    }

    function onDrop(event: DragEvent<HTMLButtonElement>) {
        event.preventDefault();
        setIsDragging(false);
        handleFile(event.dataTransfer.files[0]);
    }

    function openPicker(event: MouseEvent<HTMLButtonElement>) {
        event.preventDefault();
        inputRef.current?.click();
    }

    function openCamera(event: MouseEvent<HTMLButtonElement>) {
        event.preventDefault();
        if (cameraStatus !== 'available') {
            return;
        }

        cameraInputRef.current?.click();
    }

    function resetSample() {
        if (imageUrlRef.current) {
            URL.revokeObjectURL(imageUrlRef.current);
            imageUrlRef.current = null;
        }

        setImageSrc(sampleUrl);
        setFileName('');
        setDotSize(6);
        setDotShape('circle');
        setToneId('ink');
        setToneAmount(100);
        setInkDensity(110);
        setError('');
    }

    function downloadImage() {
        const canvas = canvasRef.current;
        if (!canvas || !isReady) {
            return;
        }

        const link = document.createElement('a');
        link.download = `retro-photo-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    const cameraAvailable = cameraStatus === 'available';

    function renderUploadDropzone() {
        return (
            <button
                className={`flex min-h-16 w-full cursor-pointer flex-col justify-between border border-dashed p-3 text-left transition ${
                    isDragging ? 'border-[#7d2f3b] bg-[#f4ead8]' : 'border-[#24201a] bg-[#faf6e8]'
                }`}
                type="button"
                onClick={openPicker}
                onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
            >
                <span className="text-sm font-bold">이미지 업로드</span>
                <span className="break-all text-xs font-normal leading-4 opacity-50">{fileName}</span>
            </button>
        );
    }

    function renderActionButtons(includeOptions = false) {
        return (
            <div className={`grid gap-2 ${includeOptions ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <button
                    className="border border-[#24201a] bg-[#24201a] px-3 py-2 text-sm font-bold text-[#fbf7e9] transition hover:bg-[#3a352c] disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    onClick={openPicker}
                >
                    선택
                </button>
                <button
                    className="border border-[#24201a] bg-[#fbf7e9] px-3 py-2 text-sm font-bold transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    onClick={openCamera}
                    disabled={!cameraAvailable}
                    aria-label={
                        cameraAvailable ? '카메라로 사진 촬영' : '현재 브라우저에서 카메라 촬영을 사용할 수 없음'
                    }
                    title={
                        cameraAvailable ? '카메라로 사진 촬영' : '현재 브라우저에서 카메라 촬영을 사용할 수 없습니다.'
                    }
                >
                    촬영
                </button>
                <button
                    className="border border-[#24201a] bg-[#fbf7e9] px-3 py-2 text-sm font-bold transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    onClick={downloadImage}
                    disabled={!isReady}
                >
                    저장
                </button>
                {includeOptions ? (
                    <button
                        className="border border-[#24201a] bg-[#7d2f3b] px-3 py-2 text-sm font-bold text-[#fbf7e9] transition hover:bg-[#6c2733]"
                        type="button"
                        onClick={() => setIsOptionsOpen(true)}
                    >
                        옵션
                    </button>
                ) : null}
            </div>
        );
    }

    function renderControls(panelId: 'desktop' | 'mobile') {
        const dotSizeId = `dot-size-${panelId}`;
        const toneAmountId = `tone-amount-${panelId}`;
        const inkDensityId = `ink-density-${panelId}`;
        const outputWidthId = `output-width-${panelId}`;

        return (
            <div className="flex flex-col gap-4">
                <div className="border border-[#24201a] bg-white/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-sm font-bold" htmlFor={dotSizeId}>
                            도트 크기
                        </label>
                        <output className="font-mono text-sm">{dotSize}px</output>
                    </div>
                    <input
                        id={dotSizeId}
                        className="mt-3 w-full accent-[#7d2f3b]"
                        type="range"
                        min="3"
                        max="28"
                        value={dotSize}
                        onChange={(event) => setDotSize(Number(event.target.value))}
                    />
                </div>

                <div className="border border-[#24201a] bg-white/70 p-4">
                    <p className="text-sm font-bold">도트 모양</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                            { id: 'circle', label: '원' },
                            { id: 'square', label: '사각형' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                className={`flex min-h-10 items-center justify-center gap-2 border px-3 py-2 text-sm font-semibold transition ${
                                    item.id === dotShape
                                        ? 'border-[#24201a] bg-[#24201a] text-[#fbf7e9]'
                                        : 'border-[#9b917e] bg-[#fbf7e9] hover:border-[#24201a]'
                                }`}
                                type="button"
                                onClick={() => setDotShape(item.id as DotShape)}
                            >
                                <span
                                    className={`h-4 w-4 border border-current ${
                                        item.id === 'circle' ? 'rounded-full' : ''
                                    }`}
                                />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="border border-[#24201a] bg-white/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-sm font-bold" htmlFor={toneAmountId}>
                            컬러톤 농도
                        </label>
                        <output className="font-mono text-sm">{toneAmount}%</output>
                    </div>
                    <input
                        id={toneAmountId}
                        className="mt-3 w-full accent-[#7d2f3b]"
                        type="range"
                        min="0"
                        max="100"
                        value={toneAmount}
                        onChange={(event) => setToneAmount(Number(event.target.value))}
                    />
                </div>

                <div className="border border-[#24201a] bg-white/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-sm font-bold" htmlFor={inkDensityId}>
                            잉크 밀도
                        </label>
                        <output className="font-mono text-sm">{inkDensity}%</output>
                    </div>
                    <input
                        id={inkDensityId}
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
                                        ? 'border-[#24201a] bg-[#24201a] text-[#fbf7e9]'
                                        : 'border-[#9b917e] bg-[#fbf7e9] hover:border-[#24201a]'
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

                <div className="border border-[#24201a] bg-white/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                        <label className="text-sm font-bold" htmlFor={outputWidthId}>
                            출력 크기
                        </label>
                        <output className="font-mono text-sm">{outputWidth}px</output>
                    </div>
                    <input
                        id={outputWidthId}
                        className="mt-3 w-full accent-[#7d2f3b]"
                        type="range"
                        min="320"
                        max={maxOutputWidth}
                        value={outputWidth}
                        onChange={(event) => setOutputWidth(Number(event.target.value))}
                    />
                    <p className="mt-2 text-xs text-[#7d2f3b] opacity-70">
                        세로는 비율에 맞게 자동 조정 · 최대 {maxOutputWidth}px
                    </p>
                </div>

                <button
                    className="border border-[#24201a] bg-[#fbf7e9] px-3 py-3 text-sm font-bold transition hover:bg-white"
                    type="button"
                    onClick={resetSample}
                >
                    초기화
                </button>

                {panelId === 'desktop' && error ? (
                    <p className="border border-[#8d3440] bg-[#f7e6e0] p-3 text-sm font-semibold text-[#7d2f3b]">
                        {error}
                    </p>
                ) : null}
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#f3f0e6] text-[#24201a]">
            <input ref={inputRef} className="sr-only" type="file" accept="image/*" onChange={onInputChange} />
            <input
                ref={cameraInputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onInputChange}
            />

            <section className="flex min-h-screen w-full flex-col gap-4 lg:grid lg:grid-cols-[330px_minmax(0,1fr)] lg:gap-0">
                <div className="border border-[#24201a] bg-[#fbf7e9] p-3 shadow-[4px_4px_0_#24201a] lg:hidden">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7d2f3b]">
                                Retro Studio
                            </p>
                            <h1 className="mt-1 text-3xl font-black leading-none">레트로 스튜디오</h1>
                        </div>
                    </div>
                    <div className="mt-3">{renderActionButtons(true)}</div>
                </div>

                {error ? (
                    <p className="border border-[#8d3440] bg-[#f7e6e0] p-3 text-sm font-semibold text-[#7d2f3b] lg:hidden">
                        {error}
                    </p>
                ) : null}

                <aside className="hidden flex-col gap-4 lg:flex lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:px-7 lg:py-4">
                    <div className="border border-[#24201a] bg-[#fbf7e9] p-5 shadow-[5px_5px_0_#24201a]">
                        <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#7d2f3b]">Retro Studio</p>
                        <h1 className="mt-3 text-3xl font-black leading-none sm:text-4xl">레트로 스튜디오</h1>
                    </div>

                    {renderUploadDropzone()}
                    {renderActionButtons()}
                    {renderControls('desktop')}
                </aside>

                <section className="grid min-h-[calc(100vh-148px)] flex-1 place-items-center bg-[#eee7d6] p-2 md:p-4 lg:h-screen lg:min-h-screen">
                    <div className="grid h-full w-full place-items-center bg-[#fbf7e9] p-2 md:p-4">
                        <div className="grid h-full min-h-[62vh] w-full place-items-center overflow-hidden bg-[#f8f2df] p-1 sm:min-h-[68vh] lg:min-h-[78vh] lg:p-2">
                            <canvas
                                ref={canvasRef}
                                className="block h-auto max-h-[74vh] w-auto max-w-full bg-[#f8f2df] lg:max-h-[84vh]"
                            />
                        </div>
                    </div>
                </section>
            </section>

            {isOptionsOpen ? (
                <div
                    className="fixed inset-0 z-50 bg-[#24201a]/45 lg:hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="mobile-options-title"
                    onClick={() => setIsOptionsOpen(false)}
                >
                    <div
                        className="absolute inset-0 flex h-dvh max-h-none flex-col bg-[#fbf7e9]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-[#24201a] p-4">
                            <h2 id="mobile-options-title" className="text-lg font-black">
                                옵션 조절
                            </h2>
                            <button
                                className="border border-[#24201a] bg-[#24201a] px-3 py-2 text-sm font-bold text-[#fbf7e9]"
                                type="button"
                                onClick={() => setIsOptionsOpen(false)}
                            >
                                닫기
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">{renderControls('mobile')}</div>
                    </div>
                </div>
            ) : null}
        </main>
    );
}
