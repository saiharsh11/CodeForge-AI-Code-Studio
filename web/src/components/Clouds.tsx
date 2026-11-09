// Soft, slowly drifting mist banks. Each track is two identical tiles side by
// side, translated by -50% in a loop, so the motion is seamless. Clouds are
// built from wide, flat radial gradients (no blur filter), which reads as
// natural haze over the mountain photo and is cheap to animate.

interface Puff { x: number; y: number; w: number; h: number; o: number }
interface Layer { top: string; height: string; duration: number; puffs: Puff[] }

const LAYERS: Layer[] = [
  {
    top: '18%', height: '30%', duration: 70,
    puffs: [
      { x: -4, y: 30, w: 34, h: 46, o: 0.5 }, { x: 10, y: 10, w: 20, h: 50, o: 0.35 },
      { x: 42, y: 40, w: 30, h: 40, o: 0.42 }, { x: 70, y: 20, w: 36, h: 52, o: 0.38 },
    ],
  },
  {
    top: '40%', height: '26%', duration: 48,
    puffs: [
      { x: 4, y: 36, w: 40, h: 44, o: 0.45 }, { x: 30, y: 18, w: 18, h: 44, o: 0.3 },
      { x: 58, y: 40, w: 34, h: 40, o: 0.4 }, { x: 84, y: 26, w: 22, h: 46, o: 0.32 },
    ],
  },
  {
    top: '62%', height: '30%', duration: 95,
    puffs: [
      { x: 0, y: 30, w: 46, h: 50, o: 0.32 }, { x: 52, y: 36, w: 44, h: 44, o: 0.28 },
    ],
  },
];

export function Clouds({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {LAYERS.map((layer, i) => (
        <div key={i} className="cf-cloud-track" style={{ top: layer.top, height: layer.height, animationDuration: `${layer.duration}s` }}>
          {[0, 1].map((tile) => (
            <div key={tile} className="relative h-full w-1/2 shrink-0">
              {layer.puffs.map((p, j) => (
                <span
                  key={j}
                  className="absolute"
                  style={{
                    left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%`,
                    background: `radial-gradient(ellipse at center, rgba(255,255,255,${p.o}) 0%, rgba(255,255,255,${p.o * 0.45}) 38%, transparent 70%)`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
